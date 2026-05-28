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

  it("starts buffering only after recording begins and supports clearing history", () => {
    const broadcaster = createLogBroadcaster();
    const statefulBroadcaster = broadcaster as typeof broadcaster & {
      clear(): void;
      readHistory(): string[];
      startRecording(): void;
    };

    broadcaster.publish('{"message":"before"}');
    statefulBroadcaster.startRecording?.();
    broadcaster.publish('{"message":"after"}');

    expect(statefulBroadcaster.readHistory?.()).toEqual(['{"message":"after"}']);

    statefulBroadcaster.clear?.();
    expect(statefulBroadcaster.readHistory?.()).toEqual([]);
  });
});
