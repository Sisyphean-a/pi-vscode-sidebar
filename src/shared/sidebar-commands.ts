export interface SidebarCommandDefinition {
  name: string;
  hint?: string;
}

export const SIDEBAR_COMMANDS: readonly SidebarCommandDefinition[] = [
  { name: "new" },
  { name: "resume" },
  { name: "tree" },
  { name: "compact", hint: "text" },
  { name: "model" },
  { name: "fork" },
  { name: "clone" },
  { name: "name", hint: "text" },
  { name: "export", hint: "path" },
  { name: "copy" },
];

export function findSidebarCommand(name: string): SidebarCommandDefinition | undefined {
  return SIDEBAR_COMMANDS.find((command) => command.name === name);
}

export function filterSidebarCommands(input: string): SidebarCommandDefinition[] {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return [...SIDEBAR_COMMANDS];
  return SIDEBAR_COMMANDS.filter((command) => command.name.includes(normalized));
}
