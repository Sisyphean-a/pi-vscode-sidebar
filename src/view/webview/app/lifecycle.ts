import type { ConversationPageFlow } from "../features/conversation/page-flow.ts";

interface CreateAppLifecycleOptions {
  conversationPage: Pick<
    ConversationPageFlow,
    "beginConversationReplay" | "startFreshConversation"
  >;
  resetComposer(): void;
  syncStreamingChrome(isStreamingPhase: boolean): void;
}

export interface AppLifecycle {
  beginConversationReplay(): void;
  isStreamingPhase(): boolean;
  setStreamingPhase(isStreaming: boolean): void;
  startFreshConversation(): void;
}

export function createAppLifecycle(options: CreateAppLifecycleOptions): AppLifecycle {
  let isStreamingPhase = false;
  options.syncStreamingChrome(isStreamingPhase);

  return {
    beginConversationReplay() {
      options.conversationPage.beginConversationReplay();
      options.resetComposer();
    },
    isStreamingPhase() {
      return isStreamingPhase;
    },
    setStreamingPhase(nextIsStreaming) {
      if (isStreamingPhase === nextIsStreaming) return;
      isStreamingPhase = nextIsStreaming;
      options.syncStreamingChrome(isStreamingPhase);
    },
    startFreshConversation() {
      options.conversationPage.startFreshConversation();
      options.resetComposer();
    },
  };
}
