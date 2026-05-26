// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderPlainTextWithReferences } from "../../../src/view/webview/markdown.ts";

describe("renderPlainTextWithReferences", () => {
  it("renders file references with inline line numbers after the file name", () => {
    const fragment = renderPlainTextWithReferences("请查看 @src/session/tracker.ts:26-39");
    const wrapper = document.createElement("div");
    wrapper.append(fragment);

    const reference = wrapper.querySelector(".file-reference-chip") as HTMLButtonElement | null;
    expect(reference?.textContent).toContain("tracker.ts:26-39");
    expect(reference?.textContent).not.toContain("src/session");
    expect(reference?.dataset.startLine).toBe("26");
    expect(reference?.dataset.endLine).toBe("39");
  });

  it("renders path-only references as compact file chips", () => {
    const fragment = renderPlainTextWithReferences("请继续看 @src/session/tracker.ts");
    const wrapper = document.createElement("div");
    wrapper.append(fragment);

    const reference = wrapper.querySelector(".file-reference-chip") as HTMLButtonElement | null;
    expect(reference?.textContent).toContain("tracker.ts");
    expect(reference?.textContent).not.toContain("src/session");
    expect(reference?.dataset.path).toBe("src/session/tracker.ts");
    expect(reference?.dataset.startLine).toBe("1");
    expect(reference?.dataset.endLine).toBeUndefined();
  });
});
