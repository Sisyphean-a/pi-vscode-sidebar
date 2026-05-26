import type { RpcCommandScope, RpcCommandSource, RpcSlashCommand } from "./rpc-types.ts";

export type SidebarCommandSource = "builtin" | RpcCommandSource;

export interface SidebarCommandDefinition {
  name: string;
  description?: string;
  hint?: string;
  source: SidebarCommandSource;
  sourceBadge?: string;
}

export const BUILTIN_SIDEBAR_COMMANDS: readonly SidebarCommandDefinition[] = [
  { name: "new", description: "Start a new session", source: "builtin" },
  { name: "resume", description: "Resume a different session", source: "builtin" },
  {
    name: "tree",
    description: "Navigate session tree (switch branches)",
    source: "builtin",
  },
  {
    name: "compact",
    description: "Manually compact the session context",
    hint: "text",
    source: "builtin",
  },
  { name: "model", description: "Select model (opens selector UI)", source: "builtin" },
  {
    name: "fork",
    description: "Create a new fork from a previous user message",
    source: "builtin",
  },
  {
    name: "clone",
    description: "Duplicate the current session at the current position",
    source: "builtin",
  },
  { name: "name", description: "Set session display name", hint: "text", source: "builtin" },
  {
    name: "export",
    description: "Export session (HTML default, or specify path: .html/.jsonl)",
    hint: "path",
    source: "builtin",
  },
  { name: "copy", description: "Copy last agent message to clipboard", source: "builtin" },
];

export function findBuiltinSidebarCommand(name: string): SidebarCommandDefinition | undefined {
  return BUILTIN_SIDEBAR_COMMANDS.find((command) => command.name === name);
}

export function filterSidebarCommands(
  input: string,
  dynamicCommands: readonly SidebarCommandDefinition[] = [],
): SidebarCommandDefinition[] {
  const allCommands = mergeSidebarCommands(dynamicCommands);
  const normalized = input.trim().toLowerCase();
  if (!normalized) return [...allCommands];
  return allCommands.filter((command) => command.name.includes(normalized));
}

export function mapRpcSlashCommands(
  commands: readonly RpcSlashCommand[],
): SidebarCommandDefinition[] {
  return commands.map((command) => ({
    name: command.name,
    description: command.description,
    source: command.source,
    sourceBadge: readSourceBadge(command.source, command.sourceInfo.scope),
  }));
}

function mergeSidebarCommands(
  dynamicCommands: readonly SidebarCommandDefinition[],
): readonly SidebarCommandDefinition[] {
  const commands = [...BUILTIN_SIDEBAR_COMMANDS];
  const builtinNames = new Set(commands.map((command) => command.name));

  for (const command of dynamicCommands) {
    if (builtinNames.has(command.name)) continue;
    commands.push(command);
  }

  return commands;
}

function readSourceBadge(source: RpcCommandSource, scope: RpcCommandScope): string | undefined {
  if (source === "skill") return "[s]";
  if (scope === "user") return "[u]";
  if (scope === "project") return "[p]";
  if (scope === "temporary") return "[t]";
  return undefined;
}
