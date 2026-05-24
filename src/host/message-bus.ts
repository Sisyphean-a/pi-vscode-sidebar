export type Unsubscribe = () => void;

export interface MessageBus<TEvent> {
  emit(event: TEvent): void;
  subscribe(listener: (event: TEvent) => void): Unsubscribe;
}

export function createMessageBus<TEvent>(): MessageBus<TEvent> {
  const listeners = new Set<(event: TEvent) => void>();

  return {
    emit(event) {
      for (const listener of listeners) listener(event);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
