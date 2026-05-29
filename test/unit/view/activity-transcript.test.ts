// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  createActivityTranscript,
  type ActivityEntryUpdate,
} from "../../../src/view/webview/features/activity/transcript.ts";
import { createPreactRenderPort } from "../../../src/view/webview/ui/preact-render-port.ts";

describe("activity transcript", () => {
  it("supports note append, key rename and reset cleanup", () => {
    const container = document.createElement("section");
    const onChange = vi.fn();
    const transcript = createActivityTranscript({
      view: createPreactRenderPort(container),
      onChange,
    });

    transcript.record(createUpdate({ groupKey: "g1", entryKey: "e1", label: "step-1" }));
    transcript.appendNote("note-1", "正在同步模型");
    transcript.renameGroup("g1", "g2");
    transcript.renameEntry("g2", "e1", "e2");

    expect(container.querySelector(".chat-activity-group")?.getAttribute("data-group-key")).toBe(
      "g2",
    );
    expect(container.querySelector(".chat-activity-item")?.getAttribute("data-entry-key")).toBe(
      "e2",
    );

    transcript.reset();

    expect(container.querySelectorAll(".chat-activity-note")).toHaveLength(0);
    expect(container.querySelectorAll(".chat-activity-group")).toHaveLength(0);
    expect(onChange).toHaveBeenCalled();
  });
});

function createUpdate(
  patch: Partial<ActivityEntryUpdate> & Pick<ActivityEntryUpdate, "groupKey" | "label">,
): ActivityEntryUpdate {
  return {
    entryKey: patch.entryKey ?? "entry-default",
    groupKey: patch.groupKey,
    label: patch.label,
    status: patch.status ?? "running",
    detail: patch.detail,
    detailSummary: patch.detailSummary,
    family: patch.family,
  };
}
