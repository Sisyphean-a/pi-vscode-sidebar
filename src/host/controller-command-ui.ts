import { randomUUID } from "node:crypto";
import { parseSidebarCommand } from "./commands/parser.ts";
import type { CommandUiRequest } from "../view/protocol.ts";
import type { RecentSessionSummary } from "../shared/recent-sessions.ts";

export function createCommandUiRequestId(): string {
  return `cmd-ui-${randomUUID()}`;
}

export function toSessionCommandUiItem(
  session: RecentSessionSummary,
): CommandUiRequest["items"][number] {
  return {
    id: session.sessionPath,
    label: session.title,
    detail: session.updatedAt,
    payload: { selectedId: session.sessionPath },
  };
}

export function normalizeParsedSidebarCommand(
  commandName: string,
  rawInput: string,
): ReturnType<typeof parseSidebarCommand> {
  const parsed = parseSidebarCommand(rawInput);
  if (!parsed) return undefined;
  return {
    ...parsed,
    name: commandName,
  };
}
