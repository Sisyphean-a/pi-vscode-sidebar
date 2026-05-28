import { effect, signal } from "@preact/signals";
import { h, render } from "preact";
import type { ConversationPageFlow } from "../features/conversation/page-flow.ts";
import type { ImageAttachmentController } from "../features/image-attachments/controller.ts";

interface CreateAppLifecycleOptions {
  conversationPage: Pick<
    ConversationPageFlow,
    "beginConversationReplay" | "startFreshConversation"
  >;
  imageAttachmentController: Pick<ImageAttachmentController, "clear">;
  newSessionButton: HTMLButtonElement;
  promptInput: HTMLTextAreaElement;
  resetComposerHeight(input: HTMLTextAreaElement): void;
  sendButton: HTMLButtonElement;
}

export interface AppLifecycle {
  beginConversationReplay(): void;
  isStreamingPhase(): boolean;
  setStreamingPhase(isStreaming: boolean): void;
  startFreshConversation(): void;
}

export function createAppLifecycle(options: CreateAppLifecycleOptions): AppLifecycle {
  const isStreamingPhaseSignal = signal(false);

  effect(() => {
    syncStreamingChrome(options, isStreamingPhaseSignal.value);
  });

  return {
    beginConversationReplay() {
      options.conversationPage.beginConversationReplay();
      resetComposerInput(options);
    },
    isStreamingPhase() {
      return isStreamingPhaseSignal.value;
    },
    setStreamingPhase(isStreaming) {
      isStreamingPhaseSignal.value = isStreaming;
    },
    startFreshConversation() {
      options.conversationPage.startFreshConversation();
      resetComposerInput(options);
    },
  };
}

function resetComposerInput(options: CreateAppLifecycleOptions): void {
  options.promptInput.value = "";
  options.imageAttachmentController.clear();
  options.resetComposerHeight(options.promptInput);
}

function syncStreamingChrome(options: CreateAppLifecycleOptions, isStreamingPhase: boolean): void {
  options.newSessionButton.disabled = isStreamingPhase;
  options.sendButton.dataset.mode = isStreamingPhase ? "stop" : "send";
  options.sendButton.title = isStreamingPhase ? "停止生成" : "发送消息";
  options.sendButton.setAttribute("aria-label", options.sendButton.title);
  render(h(SendButtonIcon, { isStreamingPhase }), options.sendButton);
}

interface SendButtonIconProps {
  isStreamingPhase: boolean;
}

function SendButtonIcon(props: SendButtonIconProps) {
  if (props.isStreamingPhase) {
    return h(
      "svg",
      { width: 16, height: 16, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true" },
      h("rect", { x: 6, y: 6, width: 12, height: 12, rx: 2 }),
    );
  }
  return h(
    "svg",
    {
      width: 16,
      height: 16,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
    },
    h("line", { x1: 22, y1: 2, x2: 11, y2: 13 }),
    h("polygon", { points: "22 2 15 22 11 13 2 9 22 2" }),
  );
}
