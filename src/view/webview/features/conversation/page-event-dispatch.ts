import {
  mapRpcSlashCommands,
  type SidebarCommandDefinition,
} from "../../../../shared/sidebar-commands.ts";
import type { ActivityController } from "../activity/controller.ts";
import type { ConversationPageEvent } from "./page-events.ts";

interface DispatchConversationPageEventOptions {
  activityController: Pick<
    ActivityController,
    | "applyAgentEnd"
    | "applyMessageEnd"
    | "applyMessageStart"
    | "applyMessageUpdate"
    | "applyToolExecutionEvent"
  >;
  applyMessageReplayQueryResult(messages: unknown[] | undefined, replace: boolean): void;
  event: ConversationPageEvent;
  onDynamicCommandsChange(commands: SidebarCommandDefinition[]): void;
}

export function dispatchConversationPageEvent(options: DispatchConversationPageEventOptions): void {
  if (options.event.kind === "handledNoop") return;
  if (options.event.kind === "activityMessageStart") {
    options.activityController.applyMessageStart(options.event.event);
    return;
  }
  if (options.event.kind === "activityMessageUpdate") {
    options.activityController.applyMessageUpdate(options.event.event);
    return;
  }
  if (options.event.kind === "activityMessageEnd") {
    options.activityController.applyMessageEnd(options.event.event);
    return;
  }
  if (options.event.kind === "activityAgentEnd") {
    options.activityController.applyAgentEnd(options.event.event);
    return;
  }
  if (options.event.kind === "toolExecutionEvent") {
    options.activityController.applyToolExecutionEvent(
      options.event.event,
      options.event.eventType,
    );
    return;
  }
  if (options.event.kind === "availableCommandsQueryResult") {
    options.onDynamicCommandsChange(mapRpcSlashCommands(options.event.commands));
    return;
  }
  options.applyMessageReplayQueryResult(options.event.messages, options.event.replace);
}
