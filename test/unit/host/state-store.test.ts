import { describe, expect, it } from "vitest";
import { createRpcSessionStateStore } from "../../../src/host/state-store.ts";

describe("createRpcSessionStateStore", () => {
  it("supports idle -> streaming -> idle transitions", () => {
    const store = createRpcSessionStateStore();

    expect(store.snapshot().phase).toBe("idle");
    store.markStreaming();
    expect(store.snapshot().phase).toBe("streaming");
    store.markIdle();
    expect(store.snapshot().phase).toBe("idle");
  });

  it("moves to process_dead when process exits unexpectedly", () => {
    const store = createRpcSessionStateStore();

    store.markStreaming();
    store.markProcessDead("process exited");

    const snapshot = store.snapshot();
    expect(snapshot.phase).toBe("process_dead");
    expect(snapshot.lastError).toBe("process exited");
  });
});
