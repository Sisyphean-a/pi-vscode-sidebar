import { describe, expect, it } from "vitest";
import { createSessionTracker } from "../../../src/session/tracker.ts";

function createWorkspaceState(initial: Record<string, string>) {
  const store = new Map<string, unknown>([["piSidebar.sessions", { ...initial }]]);
  return {
    get<T>(key: string) {
      return store.get(key) as T | undefined;
    },
    async update(key: string, value: unknown) {
      store.set(key, value);
    },
  };
}

describe("createSessionTracker", () => {
  it("prunes entries for missing session files", async () => {
    const workspaceState = createWorkspaceState({
      "session-1": "C:\\sessions\\existing.json",
      "session-2": "C:\\sessions\\missing.json",
    });

    const tracker = createSessionTracker({ workspaceState } as never, (filePath) =>
      filePath.endsWith("existing.json"),
    );

    const pruned = await tracker.pruneMissingSessions();

    expect(pruned).toEqual({ "session-1": "C:\\sessions\\existing.json" });
    expect(tracker.read()).toEqual({ "session-1": "C:\\sessions\\existing.json" });
  });
});
