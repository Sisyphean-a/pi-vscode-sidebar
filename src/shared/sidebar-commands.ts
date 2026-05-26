import type { RpcCommandScope, RpcCommandSource, RpcSlashCommand } from "./rpc-types.ts";

export type SidebarCommandLocale = "en" | "zh";
export type SidebarCommandSource = "builtin" | RpcCommandSource;

interface SidebarCommandText {
  description?: string;
}

interface BuiltinSidebarCommandDefinition {
  id: string;
  name: string;
  hint?: string;
  texts: Record<SidebarCommandLocale, SidebarCommandText>;
}

export interface SidebarCommandDefinition {
  id: string;
  name: string;
  description?: string;
  hint?: string;
  source: SidebarCommandSource;
  sourceBadge?: string;
  aliases: readonly string[];
}

const BUILTIN_SIDEBAR_COMMANDS: readonly BuiltinSidebarCommandDefinition[] = [
  {
    id: "new",
    name: "new",
    texts: {
      en: { description: "Start a new session" },
      zh: { description: "开始新会话" },
    },
  },
  {
    id: "resume",
    name: "resume",
    texts: {
      en: { description: "Resume a different session" },
      zh: { description: "恢复其他会话" },
    },
  },
  {
    id: "tree",
    name: "tree",
    texts: {
      en: { description: "Navigate session tree (switch branches)" },
      zh: { description: "浏览会话树（切换分支）" },
    },
  },
  {
    id: "compact",
    name: "compact",
    hint: "text",
    texts: {
      en: { description: "Manually compact the session context" },
      zh: { description: "手动压缩当前会话上下文" },
    },
  },
  {
    id: "model",
    name: "model",
    texts: {
      en: { description: "Select model (opens selector UI)" },
      zh: { description: "选择模型（会打开选择器）" },
    },
  },
  {
    id: "fork",
    name: "fork",
    texts: {
      en: { description: "Create a new fork from a previous user message" },
      zh: { description: "从之前的用户消息创建新分叉" },
    },
  },
  {
    id: "clone",
    name: "clone",
    texts: {
      en: { description: "Duplicate the current session at the current position" },
      zh: { description: "在当前位置复制当前会话" },
    },
  },
  {
    id: "name",
    name: "name",
    hint: "text",
    texts: {
      en: { description: "Set session display name" },
      zh: { description: "设置会话显示名称" },
    },
  },
  {
    id: "export",
    name: "export",
    hint: "path",
    texts: {
      en: { description: "Export session (HTML default, or specify path: .html/.jsonl)" },
      zh: { description: "导出会话（默认 HTML，也可指定 .html/.jsonl 路径）" },
    },
  },
  {
    id: "copy",
    name: "copy",
    texts: {
      en: { description: "Copy last agent message to clipboard" },
      zh: { description: "复制最后一条助手消息到剪贴板" },
    },
  },
];

export function resolveSidebarLocale(language: string | undefined): SidebarCommandLocale {
  return language?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function findBuiltinSidebarCommand(id: string): BuiltinSidebarCommandDefinition | undefined {
  return BUILTIN_SIDEBAR_COMMANDS.find((command) => command.id === normalizeCommandToken(id));
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
  const commands = BUILTIN_SIDEBAR_COMMANDS.map((command) =>
    localizeBuiltinCommand(command, locale),
  );
  const builtinIds = new Set(commands.map((command) => command.id));

  for (const command of dynamicCommands) {
    if (builtinIds.has(command.id)) continue;
    commands.push(command);
  }

  return commands;
}

function localizeBuiltinCommand(
  command: BuiltinSidebarCommandDefinition,
  locale: SidebarCommandLocale,
): SidebarCommandDefinition {
  const text = command.texts[locale];
  return {
    id: command.id,
    name: command.name,
    description: text.description,
    hint: command.hint,
    source: "builtin",
    aliases: [command.name],
  };
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
