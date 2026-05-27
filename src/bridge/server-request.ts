const DEFAULT_MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const DEFAULT_RPC_TIMEOUT_MS = 15000;

export interface RpcRequestPayload {
  method: string;
  params: Record<string, unknown>;
}

interface ParseBridgeRpcRequestOptions {
  authorizationHeader: string | string[] | undefined;
  bodyText: string;
  method: string | undefined;
  token: string;
  url: string | undefined;
}

export class BridgeHttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export class RpcTimeoutError extends BridgeHttpError {
  constructor(timeoutMs: number) {
    super(504, "BRIDGE_RPC_TIMEOUT", `Bridge RPC request timed out after ${timeoutMs}ms`, {
      timeoutMs,
    });
  }
}

export function normalizeMaxRequestBytes(maxRequestBytes: number | undefined): number {
  if (typeof maxRequestBytes !== "number" || !Number.isFinite(maxRequestBytes)) {
    return DEFAULT_MAX_REQUEST_BYTES;
  }
  return Math.max(1, Math.trunc(maxRequestBytes));
}

export function normalizeRpcTimeoutMs(timeoutMs: number | undefined): number {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs)) {
    return DEFAULT_RPC_TIMEOUT_MS;
  }
  return Math.max(1000, Math.trunc(timeoutMs));
}

export function normalizeToken(token: string): string {
  const normalized = token.trim();
  if (!normalized) throw new Error("Bridge token must not be empty.");
  return normalized;
}

export function parseBridgeRpcRequest(options: ParseBridgeRpcRequestOptions): RpcRequestPayload {
  validateRequestRoute(options.method, options.url);
  validateAuthorization(options.authorizationHeader, options.token);
  return normalizeRpcRequestBody(parseJsonText(options.bodyText));
}

export function toBridgeError(error: unknown): BridgeHttpError {
  if (error instanceof BridgeHttpError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("Unknown bridge method:")) {
    return new BridgeHttpError(400, "BRIDGE_UNKNOWN_METHOD", message);
  }
  return new BridgeHttpError(500, "BRIDGE_INTERNAL_ERROR", message);
}

function normalizeParams(params: unknown): Record<string, unknown> {
  if (params === undefined) return {};
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    throw new BridgeHttpError(400, "BRIDGE_INVALID_PARAMS", "RPC params must be an object");
  }
  return params as Record<string, unknown>;
}

function normalizeRpcRequestBody(body: unknown): RpcRequestPayload {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new BridgeHttpError(400, "BRIDGE_INVALID_REQUEST", "Invalid RPC request body");
  }
  const record = body as Record<string, unknown>;
  const method = typeof record.method === "string" ? record.method : undefined;
  if (!method) {
    throw new BridgeHttpError(400, "BRIDGE_INVALID_REQUEST", "Missing required field: method");
  }
  return { method, params: normalizeParams(record.params) };
}

function parseJsonText(text: string): unknown {
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

function validateAuthorization(
  authorizationHeader: string | string[] | undefined,
  token: string,
): void {
  const provided = Array.isArray(authorizationHeader)
    ? authorizationHeader[0]
    : authorizationHeader;
  if (provided !== token) {
    throw new BridgeHttpError(401, "BRIDGE_UNAUTHORIZED", "Unauthorized");
  }
}

function validateRequestRoute(method: string | undefined, url: string | undefined): void {
  if (method !== "POST" || url !== "/rpc") {
    throw new BridgeHttpError(404, "BRIDGE_NOT_FOUND", "Not found");
  }
}
