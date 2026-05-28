export interface PendingRequestStore {
  register(id: string, timeoutMs: number): Promise<unknown>;
  resolve(id: string, payload: unknown): boolean;
  reject(id: string, error: Error): boolean;
  rejectAll(error: Error): void;
}

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timeout: NodeJS.Timeout;
}

export function createPendingRequestStore(): PendingRequestStore {
  const pending = new Map<string, PendingRequest>();

  return {
    register(id, timeoutMs) {
      if (pending.has(id)) {
        throw new Error(`Duplicate RPC request id: ${id}`);
      }

      return new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`RPC timeout for request ${id}`));
        }, timeoutMs);

        pending.set(id, { resolve, reject, timeout });
      });
    },
    resolve(id, payload) {
      return complete(pending, id, payload, undefined);
    },
    reject(id, error) {
      return complete(pending, id, undefined, error);
    },
    rejectAll(error) {
      for (const id of pending.keys()) {
        complete(pending, id, undefined, error);
      }
    },
  };
}

function complete(
  pending: Map<string, PendingRequest>,
  id: string,
  payload: unknown,
  error: Error | undefined,
): boolean {
  const entry = pending.get(id);
  if (!entry) return false;

  clearTimeout(entry.timeout);
  pending.delete(id);
  if (error) entry.reject(error);
  else entry.resolve(payload);
  return true;
}
