import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

const DEFAULT_MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const DEFAULT_RPC_TIMEOUT_MS = 15000;

export interface BridgeHttpServerOptions {
  token: string;
  handleRpc(method: string, params: Record<string, unknown>): Promise<unknown>;
  maxRequestBytes?: number;
  rpcTimeoutMs?: number;
}

export interface BridgeHttpServer {
  server: Server;
  url: string;
  token: string;
  dispose(): Promise<void>;
}

export async function createBridgeHttpServer(
  options: BridgeHttpServerOptions,
): Promise<BridgeHttpServer> {
  const maxRequestBytes = options.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES;
  const server = createServer(async (request, response) => {
    await handleHttpRequest(request, response, options, maxRequestBytes);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind bridge server.");
  }

  return {
    server,
    token: options.token,
    url: `http://127.0.0.1:${address.port}`,
    dispose: () => closeServer(server),
  };
}

async function handleHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: BridgeHttpServerOptions,
  maxRequestBytes: number,
): Promise<void> {
  try {
    if (request.method !== "POST" || request.url !== "/rpc") {
      sendJson(response, 404, { error: "Not found" });
      return;
    }
    if (request.headers["x-pi-vscode-authorization"] !== options.token) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
    }

    const rpcBody = await readRpcBody(request, maxRequestBytes).catch((error) => {
      if (error instanceof PayloadTooLargeError) {
        sendJson(response, 413, { error: error.message });
        return undefined;
      }
      sendJson(response, 400, { error: toErrorMessage(error) });
      return undefined;
    });
    if (!rpcBody) return;

    if (!rpcBody.method) {
      sendJson(response, 400, { error: "Invalid RPC request" });
      return;
    }

    const timeoutMs = normalizeRpcTimeoutMs(options.rpcTimeoutMs);
    const result = await withTimeout(
      options.handleRpc(rpcBody.method, rpcBody.params ?? {}),
      timeoutMs,
    );
    sendJson(response, 200, { result });
  } catch (error) {
    if (error instanceof RpcTimeoutError) {
      sendJson(response, 504, { error: error.message });
      return;
    }
    sendJson(response, 500, { error: toErrorMessage(error) });
  }
}

async function readRpcBody(
  request: IncomingMessage,
  maxRequestBytes: number,
): Promise<{ method?: string; params?: Record<string, unknown> }> {
  const body = await readJson(request, maxRequestBytes);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {};
  }
  return body as { method?: string; params?: Record<string, unknown> };
}

async function readJson(request: IncomingMessage, maxRequestBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalSize = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalSize += buffer.length;
    if (totalSize > maxRequestBytes) {
      throw new PayloadTooLargeError(maxRequestBytes);
    }
    chunks.push(buffer);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  return JSON.parse(text) as unknown;
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class PayloadTooLargeError extends Error {
  constructor(limit: number) {
    super(`Request body exceeds ${limit} bytes`);
  }
}

class RpcTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Bridge RPC request timed out after ${timeoutMs}ms`);
  }
}

function normalizeRpcTimeoutMs(timeoutMs: number | undefined): number {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs)) {
    return DEFAULT_RPC_TIMEOUT_MS;
  }
  return Math.max(1000, Math.trunc(timeoutMs));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new RpcTimeoutError(timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
