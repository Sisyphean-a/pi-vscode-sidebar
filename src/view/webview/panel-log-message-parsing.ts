import { z } from "zod";

const PanelLogMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("log_entry"),
    line: z.string(),
  }),
  z.object({
    type: z.literal("log_history"),
    lines: z.array(z.string()),
  }),
  z.object({
    type: z.literal("log_reset"),
  }),
]);

const PanelLogUiMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ui_ready") }),
  z.object({ type: z.literal("clear_panel_logs") }),
]);

const JsonObjectSchema = z.object({}).catchall(z.unknown());

export type PanelLogMessage = z.infer<typeof PanelLogMessageSchema>;
export type PanelLogUiMessage = z.infer<typeof PanelLogUiMessageSchema>;

export function parsePanelLogMessage(value: unknown): PanelLogMessage | undefined {
  const parsed = PanelLogMessageSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function parsePanelLogUiMessage(value: unknown): PanelLogUiMessage | undefined {
  const parsed = PanelLogUiMessageSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function parsePanelLogLine(line: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(line) as unknown;
    const parsedObject = JsonObjectSchema.safeParse(parsed);
    return parsedObject.success ? parsedObject.data : undefined;
  } catch {
    return undefined;
  }
}
