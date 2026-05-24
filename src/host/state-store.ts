export type RpcSessionPhase = "idle" | "streaming" | "awaiting_extension_ui" | "process_dead";

export interface RpcSessionViewState {
  phase: RpcSessionPhase;
  lastError?: string;
  updatedAt: number;
}

export interface RpcSessionStateStore {
  snapshot(): RpcSessionViewState;
  markIdle(): RpcSessionViewState;
  markStreaming(): RpcSessionViewState;
  markAwaitingExtensionUi(): RpcSessionViewState;
  markProcessDead(error: string): RpcSessionViewState;
}

export function createRpcSessionStateStore(): RpcSessionStateStore {
  let state: RpcSessionViewState = {
    phase: "idle",
    updatedAt: Date.now(),
  };

  return {
    snapshot: () => ({ ...state }),
    markIdle: () => {
      state = toState("idle", undefined);
      return { ...state };
    },
    markStreaming: () => {
      state = toState("streaming", undefined);
      return { ...state };
    },
    markAwaitingExtensionUi: () => {
      state = toState("awaiting_extension_ui", undefined);
      return { ...state };
    },
    markProcessDead: (error) => {
      state = toState("process_dead", error);
      return { ...state };
    },
  };
}

function toState(phase: RpcSessionPhase, error: string | undefined): RpcSessionViewState {
  return {
    phase,
    lastError: error,
    updatedAt: Date.now(),
  };
}
