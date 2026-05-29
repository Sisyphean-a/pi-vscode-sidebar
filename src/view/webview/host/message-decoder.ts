import { z } from "zod";

export interface DecodedHostStatePayload {
  rpc: Record<string, unknown> | undefined;
  state: Record<string, unknown>;
}

export type DecodedHostEventPayload =
  | { kind: "query_result"; event: { type: "query_result"; command: string } & Record<string, unknown> }
  | { kind: "thinking_level_changed"; level: string }
  | { kind: "other"; event: Record<string, unknown> };

const HostEventSchema = z.object({ type: z.string() }).catchall(z.unknown());
const ThinkingLevelChangedEventSchema = z
  .object({ type: z.literal("thinking_level_changed"), level: z.string() })
  .catchall(z.unknown());
const QueryResultEventSchema = z
  .object({ type: z.literal("query_result"), command: z.string() })
  .catchall(z.unknown());
const HostStatePayloadSchema = z
  .object({
    rpc: z.object({}).catchall(z.unknown()).optional(),
  })
  .catchall(z.unknown());

export function decodeHostEventPayload(data: unknown): DecodedHostEventPayload | undefined {
  const parsedEvent = HostEventSchema.safeParse(data);
  if (!parsedEvent.success) return undefined;

  if (parsedEvent.data.type === "thinking_level_changed") {
    const thinkingLevelChanged = ThinkingLevelChangedEventSchema.safeParse(parsedEvent.data);
    if (!thinkingLevelChanged.success) return undefined;
    return { kind: "thinking_level_changed", level: thinkingLevelChanged.data.level };
  }
  if (parsedEvent.data.type === "query_result") {
    const queryResult = QueryResultEventSchema.safeParse(parsedEvent.data);
    if (!queryResult.success) return undefined;
    return { kind: "query_result", event: queryResult.data };
  }
  return { kind: "other", event: parsedEvent.data };
}

export function decodeHostStatePayload(data: unknown): DecodedHostStatePayload | undefined {
  const parsedState = HostStatePayloadSchema.safeParse(data);
  if (!parsedState.success) return undefined;
  return {
    rpc: parsedState.data.rpc,
    state: parsedState.data,
  };
}
