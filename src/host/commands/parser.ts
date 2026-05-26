export interface ParsedSidebarCommand {
  name: string;
  rawInput: string;
  tail: string;
}

export function parseSidebarCommand(rawInput: string): ParsedSidebarCommand | undefined {
  const trimmed = rawInput.trim();
  if (!trimmed.startsWith("/")) return undefined;
  const body = trimmed.slice(1);
  const spaceIndex = body.indexOf(" ");
  const name = (spaceIndex === -1 ? body : body.slice(0, spaceIndex)).trim();
  if (!name) return undefined;
  const tail = spaceIndex === -1 ? "" : body.slice(spaceIndex + 1).trim();
  return { name, rawInput: trimmed, tail };
}
