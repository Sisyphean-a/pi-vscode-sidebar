import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

const DEFAULT_MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const DEFAULT_RPC_TIMEOUT_MS = 15000;

interface RpcRequestPayload {
  method: string;
  params: Record<string, unknown>;
}

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
    validateRequestRoute(request);
    validateAuthorization(request, options.token);
    const rpcBody = await readRpcBody(request, maxRequestBytes);
    const timeoutMs = normalizeRpcTimeoutMs(options.rpcTimeoutMs);
    const result = await withTimeout(options.handleRpc(rpcBody.method, rpcBody.params), timeoutMs);
    sendJson(response, 200, { result });
  } catch (error) {
    sendError(response, toBridgeError(error));
  }
}

function validateRequestRoute(request: IncomingMessage): void {
  if (request.method !== "POST" || request.url !== "/rpc") {
    throw new BridgeHttpError(404, "BRIDGE_NOT_FOUND", "Not found");
  }
}

function validateAuthorization(request: IncomingMessage, token: string): void {
  const authHeader = request.headers["x-pi-vscode-authorization"];
  const provided = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (provided !== token) {
    throw new BridgeHttpError(401, "BRIDGE_UNAUTHORIZED", "Unauthorized");
  }
}

async function readRpcBody(
  request: IncomingMessage,
  maxRequestBytes: number,
): Promise<RpcRequestPayload> {
  const rawBody = await readJson(request, maxRequestBytes);
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    throw new BridgeHttpError(400, "BRIDGE_INVALID_REQUEST", "Invalid RPC request body");
  }
  const body = rawBody as Record<string, unknown>;
  const method = typeof body.method === "string" ? body.method : undefined;
  if (!method) {
    throw new BridgeHttpError(400, "BRIDGE_INVALID_REQUEST", "Missing required field: method");
  }

  const params = normalizeParams(body.params);
  return { method, params };
}

function normalizeParams(params: unknown): Record<string, unknown> {
  if (params === undefined) return {};
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    throw new BridgeHttpError(400, "BRIDGE_INVALID_PARAMS", "RPC params must be an object");
  }
  return params as Record<string, unknown>;
}

async function readJson(request: IncomingMessage, maxRequestBytes: number): Promise<unknown> {
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

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new BridgeHttpError(400, "BRIDGE_INVALID_JSON", "Failed to parse request JSON", {
      detail,
    });
  }
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

class BridgeHttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

class RpcTimeoutError extends BridgeHttpError {
  constructor(timeoutMs: number) {
    super(504, "BRIDGE_RPC_TIMEOUT", `Bridge RPC request timed out after ${timeoutMs}ms`, {
      timeoutMs,
    });
  }
}

function toBridgeError(error: unknown): BridgeHttpError {
  if (error instanceof BridgeHttpError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("Unknown bridge method:")) {
    return new BridgeHttpError(400, "BRIDGE_UNKNOWN_METHOD", message);
  }
  return new BridgeHttpError(500, "BRIDGE_INTERNAL_ERROR", message);
}

function normalizeToken(token: string): string {
  const normalized = token.trim();
  if (!normalized) {
    throw new Error("Bridge token must not be empty.");
  }
  return normalized;
}

function normalizeMaxRequestBytes(maxRequestBytes: number | undefined): number {
  if (typeof maxRequestBytes !== "number" || !Number.isFinite(maxRequestBytes)) {
    return DEFAULT_MAX_REQUEST_BYTES;
  }
  return Math.max(1, Math.trunc(maxRequestBytes));
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
