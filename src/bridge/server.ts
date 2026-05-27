import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import {
  BridgeHttpError,
  RpcTimeoutError,
  normalizeMaxRequestBytes,
  normalizeRpcTimeoutMs,
  normalizeToken,
  parseBridgeRpcRequest,
  toBridgeError,
} from "./server-request.ts";

interface BridgeErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

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
  const token = normalizeToken(options.token);
  const maxRequestBytes = normalizeMaxRequestBytes(options.maxRequestBytes);
  const server = createServer(async (request, response) => {
    await handleHttpRequest(request, response, { ...options, token }, maxRequestBytes);
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
    token,
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
    const rpcBody = parseBridgeRpcRequest({
      method: request.method,
      url: request.url,
      authorizationHeader: request.headers["x-pi-vscode-authorization"],
      token: options.token,
      bodyText: await readRequestBodyText(request, maxRequestBytes),
    });
    const timeoutMs = normalizeRpcTimeoutMs(options.rpcTimeoutMs);
    const result = await withTimeout(options.handleRpc(rpcBody.method, rpcBody.params), timeoutMs);
    sendJson(response, 200, { result });
  } catch (error) {
    sendError(response, toBridgeError(error));
  }
}

async function readRequestBodyText(
  request: IncomingMessage,
  maxRequestBytes: number,
): Promise<string> {
  const chunks: Buffer[] = [];
  let totalSize = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalSize += buffer.length;
    if (totalSize > maxRequestBytes) {
      throw new BridgeHttpError(413, "BRIDGE_PAYLOAD_TOO_LARGE", "Request body exceeds limit", {
        maxRequestBytes,
      });
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
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

function sendError(response: ServerResponse, error: BridgeHttpError): void {
  sendJson(response, error.statusCode, {
    code: error.code,
    message: error.message,
    details: error.details,
  } satisfies BridgeErrorPayload);
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
