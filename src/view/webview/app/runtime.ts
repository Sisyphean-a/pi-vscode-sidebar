import { resolveSidebarLocale } from "../../../shared/sidebar-commands.ts";
import { createSidebarAppRuntime as buildSidebarAppRuntime } from "./runtime-builders.ts";
import { createRuntimeViewPorts } from "./view-ports.ts";
import { createUiMessagePoster } from "../host/ui-message-poster.ts";

interface VsCodeApi {
  postMessage(message: object): void;
}

interface InitializeSidebarAppOptions {
  root: HTMLElement;
  vscode: VsCodeApi;
}

export function initializeSidebarApp(options: InitializeSidebarAppOptions): void {
  const viewPorts = createRuntimeViewPorts(options.root);
  const locale = resolveSidebarLocale(document.documentElement.lang);
  const uiMessagePoster = createUiMessagePoster(options.vscode);
  const runtime = buildSidebarAppRuntime({ locale, uiMessagePoster, viewPorts });

  runtime.bindEvents({
    onAbort() {
      uiMessagePoster.post({ type: "abort" });
    },
    onNewSession() {
      uiMessagePoster.post({ type: "new_session" });
    },
  });

  uiMessagePoster.post({ type: "ui_ready" });
  runtime.modelControls.requestAvailableModels();
}
