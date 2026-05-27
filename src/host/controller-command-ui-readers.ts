import type { CommandUiItem } from "../view/protocol.ts";
import type { RpcSlashCommand, RpcSessionTreeNode } from "../shared/rpc-types.ts";

export function readSelectedCommandUiId(payload: unknown): string | undefined {
  if (typeof payload === "string" && payload) return payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const selectedId = (payload as { selectedId?: unknown }).selectedId;
  return typeof selectedId === "string" && selectedId ? selectedId : undefined;
}

export function readModelSelection(
  payload: unknown,
): { provider: string; modelId: string } | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const provider = (payload as { provider?: unknown }).provider;
  const modelId = (payload as { modelId?: unknown }).modelId;
  if (typeof provider !== "string" || !provider) return undefined;
  if (typeof modelId !== "string" || !modelId) return undefined;
  return { provider, modelId };
}

export function readModelCommandUiItems(data: unknown): CommandUiItem[] {
  const models = Array.isArray((data as { models?: unknown[] } | undefined)?.models)
    ? (data as { models: unknown[] }).models
    : [];
  return models.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const provider = (entry as { provider?: unknown }).provider;
    const id = (entry as { id?: unknown }).id;
    if (typeof provider !== "string" || !provider) return [];
    if (typeof id !== "string" || !id) return [];
    const name = (entry as { name?: unknown }).name;
    return [
      {
        id: `${provider}/${id}`,
        label: typeof name === "string" && name ? name : id,
        detail: provider,
        payload: { provider, modelId: id },
      },
    ];
  });
}

export function readForkCommandUiItems(data: unknown): CommandUiItem[] {
  const messages = Array.isArray((data as { messages?: unknown[] } | undefined)?.messages)
    ? (data as { messages: unknown[] }).messages
    : [];
  return messages.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const entryId = (entry as { entryId?: unknown }).entryId;
    const text = (entry as { text?: unknown }).text;
    if (typeof entryId !== "string" || !entryId) return [];
    if (typeof text !== "string" || !text) return [];
    return [
      {
        id: entryId,
        label: truncateLabel(text),
        payload: { selectedId: entryId },
      },
    ];
  });
}

export function readTreeCommandUiItems(data: unknown): CommandUiItem[] {
  const nodes = Array.isArray((data as { nodes?: RpcSessionTreeNode[] } | undefined)?.nodes)
    ? (data as { nodes: RpcSessionTreeNode[] }).nodes
    : [];
  return nodes.map((node) => ({
    id: node.entryId,
    label: node.label?.trim() || truncateLabel(node.previewText),
    detail: node.label?.trim() ? truncateLabel(node.previewText) : undefined,
    depth: node.depth,
    active: node.isActive,
    payload: { selectedId: node.entryId },
  }));
}

export function readSlashCommands(data: unknown): RpcSlashCommand[] {
  const commands = (data as { commands?: unknown } | undefined)?.commands;
  if (!Array.isArray(commands)) return [];
  return commands.filter((command): command is RpcSlashCommand => {
    if (!command || typeof command !== "object" || Array.isArray(command)) return false;
    const record = command as Record<string, unknown>;
    return (
      typeof record.name === "string" &&
      typeof record.source === "string" &&
      typeof record.sourceInfo === "object" &&
      record.sourceInfo !== null
    );
  });
}

export function readLastAssistantText(data: unknown): string | undefined {
  const text = (data as { text?: unknown } | undefined)?.text;
  return typeof text === "string" && text ? text : undefined;
}

export function readExportPath(data: unknown): string | undefined {
  const path = (data as { path?: unknown } | undefined)?.path;
  return typeof path === "string" && path ? path : undefined;
}

function truncateLabel(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 72) return trimmed;
  return `${trimmed.slice(0, 72)}...`;
}
