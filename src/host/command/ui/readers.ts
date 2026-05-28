import { z } from "zod";
import type { CommandUiItem } from "../../../view/protocol.ts";
import type { RpcSlashCommand, RpcSessionTreeNode } from "../../../shared/rpc-types.ts";

export function readSelectedCommandUiId(payload: unknown): string | undefined {
  const direct = NonEmptyStringSchema.safeParse(payload);
  if (direct.success) return direct.data;
  const objectPayload = SelectedIdPayloadSchema.safeParse(payload);
  if (!objectPayload.success) return undefined;
  return objectPayload.data.selectedId;
}

export function readModelSelection(
  payload: unknown,
): { provider: string; modelId: string } | undefined {
  const parsed = ModelSelectionPayloadSchema.safeParse(payload);
  if (!parsed.success) return undefined;
  return parsed.data;
}

export function readModelCommandUiItems(data: unknown): CommandUiItem[] {
  const modelPayload = ModelListPayloadSchema.safeParse(data);
  if (!modelPayload.success) return [];
  return modelPayload.data.models.flatMap((entry) => {
    const parsedModel = ModelEntrySchema.safeParse(entry);
    if (!parsedModel.success) return [];
    const { provider, id, name } = parsedModel.data;
    return [
      {
        id: `${provider}/${id}`,
        label: name ?? id,
        detail: provider,
        payload: { provider, modelId: id },
      },
    ];
  });
}

export function readForkCommandUiItems(data: unknown): CommandUiItem[] {
  const messagePayload = ForkMessagePayloadSchema.safeParse(data);
  if (!messagePayload.success) return [];
  return messagePayload.data.messages.flatMap((entry) => {
    const parsedEntry = ForkMessageEntrySchema.safeParse(entry);
    if (!parsedEntry.success) return [];
    const { entryId, text } = parsedEntry.data;
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
  const treePayload = TreeNodePayloadSchema.safeParse(data);
  if (!treePayload.success) return [];
  return treePayload.data.nodes.flatMap((entry) => {
    const parsedNode = SessionTreeNodeSchema.safeParse(entry);
    if (!parsedNode.success) return [];
    const node = parsedNode.data;
    return [
      {
        id: node.entryId,
        label: node.label?.trim() || truncateLabel(node.previewText),
        detail: node.label?.trim() ? truncateLabel(node.previewText) : undefined,
        depth: node.depth,
        active: node.isActive,
        payload: { selectedId: node.entryId },
      },
    ];
  });
}

export function readSlashCommands(data: unknown): RpcSlashCommand[] {
  const commandPayload = SlashCommandPayloadSchema.safeParse(data);
  if (!commandPayload.success) return [];
  const parsedCommands = commandPayload.data.commands.flatMap((entry) => {
    const parsedCommand = RpcSlashCommandSchema.safeParse(entry);
    return parsedCommand.success ? [parsedCommand.data] : [];
  });
  return parsedCommands as unknown as RpcSlashCommand[];
}

export function readLastAssistantText(data: unknown): string | undefined {
  const parsed = LastAssistantTextPayloadSchema.safeParse(data);
  if (!parsed.success) return undefined;
  return parsed.data.text;
}

export function readExportPath(data: unknown): string | undefined {
  const parsed = ExportPathPayloadSchema.safeParse(data);
  if (!parsed.success) return undefined;
  return parsed.data.path;
}

function truncateLabel(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 72) return trimmed;
  return `${trimmed.slice(0, 72)}...`;
}

const NonEmptyStringSchema = z.string().min(1);
const SelectedIdPayloadSchema = z.object({ selectedId: NonEmptyStringSchema });
const ModelSelectionPayloadSchema = z.object({
  provider: NonEmptyStringSchema,
  modelId: NonEmptyStringSchema,
});
const ModelEntrySchema = z.object({
  provider: NonEmptyStringSchema,
  id: NonEmptyStringSchema,
  name: NonEmptyStringSchema.optional(),
});
const ModelListPayloadSchema = z.object({ models: z.array(z.unknown()) });
const ForkMessageEntrySchema = z.object({
  entryId: NonEmptyStringSchema,
  text: NonEmptyStringSchema,
});
const ForkMessagePayloadSchema = z.object({ messages: z.array(z.unknown()) });
const SessionTreeNodeSchema: z.ZodType<RpcSessionTreeNode> = z.object({
  entryId: NonEmptyStringSchema,
  parentEntryId: z.string().optional(),
  label: z.string().optional(),
  previewText: z.string(),
  depth: z.number(),
  isActive: z.boolean(),
  hasChildren: z.boolean().optional().default(false),
});
const TreeNodePayloadSchema = z.object({ nodes: z.array(z.unknown()) });
const RpcSlashCommandSchema = z.object({
  name: NonEmptyStringSchema,
  description: z.string().optional(),
  source: z.enum(["extension", "prompt", "skill"]),
  sourceInfo: z.object({}).catchall(z.unknown()),
});
const SlashCommandPayloadSchema = z.object({ commands: z.array(z.unknown()) });
const LastAssistantTextPayloadSchema = z.object({ text: NonEmptyStringSchema });
const ExportPathPayloadSchema = z.object({ path: NonEmptyStringSchema });
