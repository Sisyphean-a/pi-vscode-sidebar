import type { RpcCommandScope, RpcCommandSource, RpcSlashCommand } from "./rpc-types.ts";
import {
  findBuiltinSidebarCommand as findBuiltinSidebarCommandInCatalog,
  listLocalizedBuiltinSidebarCommands,
  type BuiltinSidebarCommandDefinition,
} from "./sidebar-command-builtins.ts";

export type SidebarCommandLocale = "en" | "zh";
export type SidebarCommandSource = "builtin" | RpcCommandSource;

export interface SidebarCommandDefinition {
  id: string;
  name: string;
  description?: string;
  hint?: string;
  source: SidebarCommandSource;
  sourceBadge?: string;
  aliases: readonly string[];
}

export function resolveSidebarLocale(language: string | undefined): SidebarCommandLocale {
  return language?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function findBuiltinSidebarCommand(id: string): BuiltinSidebarCommandDefinition | undefined {
  return findBuiltinSidebarCommandInCatalog(id);
}

export function filterSidebarCommands(
  input: string,
  locale: SidebarCommandLocale,
  dynamicCommands: readonly SidebarCommandDefinition[] = [],
): SidebarCommandDefinition[] {
  const allCommands = mergeSidebarCommands(locale, dynamicCommands);
  const normalized = normalizeCommandToken(input);
  if (!normalized) return [...allCommands];
  return allCommands.filter((command) => matchesCommandQuery(command, normalized));
}

export function mapRpcSlashCommands(
  commands: readonly RpcSlashCommand[],
): SidebarCommandDefinition[] {
  return commands.map((command) => ({
    id: command.name,
    name: command.name,
    description: command.description,
    source: command.source,
    sourceBadge: readSourceBadge(command.source, command.sourceInfo.scope),
    aliases: [command.name],
  }));
}

export function resolveSidebarCommandId(
  rawInput: string,
  locale: SidebarCommandLocale,
  dynamicCommands: readonly SidebarCommandDefinition[] = [],
): string | undefined {
  const token = readSlashCommandToken(rawInput);
  if (!token) return undefined;
  const normalizedToken = normalizeCommandToken(token);
  const matched = mergeSidebarCommands(locale, dynamicCommands).find((command) =>
    command.aliases.some((alias) => normalizeCommandToken(alias) === normalizedToken),
  );
  return matched?.id;
}

export function isExactSidebarCommandMatch(
  rawInput: string,
  locale: SidebarCommandLocale,
  dynamicCommands: readonly SidebarCommandDefinition[] = [],
): boolean {
  const token = readSlashCommandToken(rawInput);
  if (!token) return false;
  const normalizedToken = normalizeCommandToken(token);
  const matched = mergeSidebarCommands(locale, dynamicCommands).find((command) =>
    command.aliases.some((alias) => normalizeCommandToken(alias) === normalizedToken),
  );
  return !!matched;
}

function mergeSidebarCommands(
  locale: SidebarCommandLocale,
  dynamicCommands: readonly SidebarCommandDefinition[],
): readonly SidebarCommandDefinition[] {
  const commands = listLocalizedBuiltinSidebarCommands(locale);
  const builtinIds = new Set(commands.map((command) => command.id));

  for (const command of dynamicCommands) {
    if (builtinIds.has(command.id)) continue;
    commands.push(command);
  }

  return commands;
}

function matchesCommandQuery(command: SidebarCommandDefinition, normalizedQuery: string): boolean {
  return command.aliases.some((alias) => normalizeCommandToken(alias).includes(normalizedQuery));
}

function readSlashCommandToken(rawInput: string): string | undefined {
  const trimmed = rawInput.trim();
  if (!trimmed.startsWith("/")) return undefined;
  const body = trimmed.slice(1);
  const spaceIndex = body.indexOf(" ");
  const token = (spaceIndex === -1 ? body : body.slice(0, spaceIndex)).trim();
  return token || undefined;
}

function normalizeCommandToken(value: string): string {
  return value.trim().toLowerCase();
}

function readSourceBadge(source: RpcCommandSource, scope: RpcCommandScope): string | undefined {
  if (source === "skill") return "[s]";
  if (scope === "user") return "[u]";
  if (scope === "project") return "[p]";
  if (scope === "temporary") return "[t]";
  return undefined;
}
