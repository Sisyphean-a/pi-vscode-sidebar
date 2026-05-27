import { describe, expect, it, vi } from "vitest";

import { createLogBroadcaster } from "../../../src/host/log-broadcaster.ts";

describe("log broadcaster", () => {
  it("publishes lines to active subscribers", () => {
    const broadcaster = createLogBroadcaster();
    const first = vi.fn();
    const second = vi.fn();

    const unsubscribeFirst = broadcaster.subscribe(first);
    broadcaster.subscribe(second);
    broadcaster.publish('{"message":"one"}');

    expect(first).toHaveBeenCalledWith('{"message":"one"}');
    expect(second).toHaveBeenCalledWith('{"message":"one"}');

    unsubscribeFirst();
    broadcaster.publish('{"message":"two"}');

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenLastCalledWith('{"message":"two"}');
  });

  it("does not replay historical lines to new subscribers", () => {
    const broadcaster = createLogBroadcaster();
    const listener = vi.fn();

    broadcaster.publish('{"message":"before"}');
    broadcaster.subscribe(listener);
    broadcaster.publish('{"message":"after"}');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('{"message":"after"}');
  });
});
