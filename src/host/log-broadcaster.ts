export interface LogBroadcaster {
  publish(line: string): void;
  subscribe(listener: (line: string) => void): () => void;
}

export function createLogBroadcaster(): LogBroadcaster {
  const listeners = new Set<(line: string) => void>();

  return {
    publish(line) {
      for (const listener of listeners) {
        listener(line);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
