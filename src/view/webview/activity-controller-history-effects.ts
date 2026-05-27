import {
  extractMessageText,
  extractThinkingTextFromMessage,
  resolveToolFamily,
  summarizeToolLabel,
  summarizeToolResultDetailSummary,
} from "./activity-event-utils.ts";
import type { ActivityControllerEffectPlan } from "./activity-controller-effects.ts";
import { readString } from "./ui-text.ts";

export function planHistoryMessageEffects(
  message: Record<string, unknown>,
  index: number,
): ActivityControllerEffectPlan {
  const role = readString(message.role);
  if (role === "user") return planHistoryUserMessage(message, index);
  if (role === "assistant") return planHistoryAssistantMessage(message, index);
  if (role === "toolResult") return planHistoryToolResultMessage(message, index);
  return { effects: [] };
}

function planHistoryAssistantMessage(
  message: Record<string, unknown>,
  index: number,
): ActivityControllerEffectPlan {
  const plan: ActivityControllerEffectPlan = { effects: [] };
  const responseId = readString(message.responseId) ?? readString(message.id);
  const thinkingText = extractThinkingTextFromMessage(message);
  if (thinkingText) {
    const groupKey = responseId ? `history:thinking:${responseId}` : `history:thinking:${index}`;
    const entryKey = responseId ? `${responseId}:thinking` : `history:thinking-entry:${index}`;
    plan.effects.push({
      type: "recordTranscript",
      update: {
        groupKey,
        entryKey,
        status: "done",
        label: `思考：${thinkingText}`,
        family: "thinking",
      },
    });
    plan.effects.push({ type: "finalizeGroup", groupKey });
  }

  const text = extractMessageText(message);
  if (text) {
    plan.effects.push({
      type: "feedMessage",
      key: responseId ?? `history:assistant:${index}`,
      role: "assistant",
      text,
      mode: "replace",
    });
  }
  return plan;
}

function planHistoryToolResultMessage(
  message: Record<string, unknown>,
  index: number,
): ActivityControllerEffectPlan {
  const toolName = readString(message.toolName) ?? "tool";
  const output = extractMessageText(message);
  const groupKey = `history:tool-group:${index}`;
  return {
    effects: [
      {
        type: "recordTranscript",
        update: {
          groupKey,
          entryKey:
            readString(message.toolCallId) ?? readString(message.id) ?? `history:tool:${index}`,
          status: "done",
          label: summarizeToolLabel(toolName, undefined, output),
          detail: output || undefined,
          detailSummary: summarizeToolResultDetailSummary(toolName, output),
          family: resolveToolFamily(toolName),
        },
      },
      { type: "finalizeGroup", groupKey },
    ],
  };
}

function planHistoryUserMessage(
  message: Record<string, unknown>,
  index: number,
): ActivityControllerEffectPlan {
  const text = extractMessageText(message);
  if (!text) return { effects: [] };
  return {
    effects: [
      {
        type: "feedMessage",
        key: readString(message.id) ?? `history:user:${index}`,
        role: "user",
        text,
        mode: "replace",
      },
    ],
  };
}
