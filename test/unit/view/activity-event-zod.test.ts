import { describe, expect, it } from "vitest";
import {
  readActivityMessageRole,
  readRecord,
  readRecordArray,
  readString,
  readToolExecutionEventType,
} from "../../../src/view/webview/features/activity/event-zod.ts";

describe("activity event zod readers", () => {
  it("reads record and record array values", () => {
    expect(readRecord({ a: 1 })).toEqual({ a: 1 });
    expect(readRecord([1, 2])).toBeUndefined();

    expect(readRecordArray([{ a: 1 }, { b: 2 }])).toEqual([{ a: 1 }, { b: 2 }]);
    expect(readRecordArray([{ a: 1 }, 2])).toBeUndefined();
  });

  it("reads primitive and enum-backed values", () => {
    expect(readString("hello")).toBe("hello");
    expect(readString(1)).toBeUndefined();

    expect(readToolExecutionEventType("tool_execution_start")).toBe("tool_execution_start");
    expect(readToolExecutionEventType("message_update")).toBeUndefined();

    expect(readActivityMessageRole("assistant")).toBe("assistant");
    expect(readActivityMessageRole("system")).toBeUndefined();
  });
});
