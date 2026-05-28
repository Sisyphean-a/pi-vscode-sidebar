export interface LogBroadcaster {
  clear(): void;
  publish(line: string): void;
  readHistory(): string[];
  startRecording(): void;
  subscribe(listener: (line: string) => void): () => void;
}

export function createLogBroadcaster(): LogBroadcaster {
  const listeners = new Set<(line: string) => void>();
  const history: string[] = [];
  let isRecording = false;

  return {
    clear() {
      history.length = 0;
    },
    publish(line) {
      if (isRecording) {
        history.push(line);
      }
      for (const listener of listeners) {
        listener(line);
      }
    },
    readHistory() {
      return [...history];
    },
    startRecording() {
      isRecording = true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
