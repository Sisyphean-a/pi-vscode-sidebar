import { z } from "zod";

const PanelLogMessageSchema = z.object({
  type: z.literal("log_entry"),
  line: z.string(),
});

const JsonObjectSchema = z.object({}).catchall(z.unknown());

export type PanelLogMessage = z.infer<typeof PanelLogMessageSchema>;

export function parsePanelLogMessage(value: unknown): PanelLogMessage | undefined {
  const parsed = PanelLogMessageSchema.safeParse(value);
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
