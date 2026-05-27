import { beforeEach, describe, expect, it, vi } from "vitest";

const registerWebviewViewProvider = vi.fn();
const onDidChangeConfiguration = vi.fn();
const getConfiguration = vi.fn();

vi.mock("vscode", () => ({
  window: {
    registerWebviewViewProvider,
  },
  workspace: {
    getConfiguration,
    onDidChangeConfiguration,
  },
}));

describe("registerPanelLogView", () => {
  beforeEach(() => {
    vi.resetModules();
    registerWebviewViewProvider.mockReset();
    onDidChangeConfiguration.mockReset();
    getConfiguration.mockReset();
  });

  it("registers the panel log provider when enabled", async () => {
    const registration = { dispose: vi.fn() };
    registerWebviewViewProvider.mockReturnValue(registration);
    getConfiguration.mockReturnValue({
      get: vi.fn(() => true),
    });
    onDidChangeConfiguration.mockReturnValue({ dispose() {} });

    const { registerPanelLogView } = await import("../../../src/bootstrap/panel-log-view.ts");
    const provider = {} as never;
    const context = { subscriptions: [] as unknown[] };

    registerPanelLogView(context as never, provider);

    expect(registerWebviewViewProvider).toHaveBeenCalledWith("piSidebar.logs", provider, {
      webviewOptions: {
        retainContextWhenHidden: false,
      },
    });
    expect(context.subscriptions).toHaveLength(2);
  });

  it("disposes and re-registers when the setting changes", async () => {
    const first = { dispose: vi.fn() };
    const second = { dispose: vi.fn() };
    registerWebviewViewProvider.mockReturnValueOnce(first).mockReturnValueOnce(second);
    let enabled = true;
    getConfiguration.mockReturnValue({
      get: vi.fn(() => enabled),
    });
    let changeHandler: ((event: { affectsConfiguration(section: string): boolean }) => void) | undefined;
    onDidChangeConfiguration.mockImplementation((handler) => {
      changeHandler = handler;
      return { dispose() {} };
    });

    const { registerPanelLogView } = await import("../../../src/bootstrap/panel-log-view.ts");
    const provider = {} as never;
    const context = { subscriptions: [] as unknown[] };

    registerPanelLogView(context as never, provider);
    enabled = false;
    changeHandler?.({
      affectsConfiguration(section: string) {
        return section === "piSidebar.panelLogs.enabled";
      },
    });
    enabled = true;
    changeHandler?.({
      affectsConfiguration(section: string) {
        return section === "piSidebar.panelLogs.enabled";
      },
    });

    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(registerWebviewViewProvider).toHaveBeenCalledTimes(2);
    expect(second.dispose).not.toHaveBeenCalled();
  });
});
