import type { SidebarCommandDefinition, SidebarCommandLocale } from "./sidebar-commands.ts";

interface SidebarCommandText {
  description?: string;
}

export interface BuiltinSidebarCommandDefinition {
  id: string;
  name: string;
  hint?: string;
  texts: Record<SidebarCommandLocale, SidebarCommandText>;
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

export function findBuiltinSidebarCommand(id: string): BuiltinSidebarCommandDefinition | undefined {
  return BUILTIN_SIDEBAR_COMMANDS.find(
    (command) => command.id === normalizeBuiltinCommandToken(id),
  );
}

export function listLocalizedBuiltinSidebarCommands(
  locale: SidebarCommandLocale,
): SidebarCommandDefinition[] {
  return BUILTIN_SIDEBAR_COMMANDS.map((command) => localizeBuiltinCommand(command, locale));
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

function normalizeBuiltinCommandToken(value: string): string {
  return value.trim().toLowerCase();
}
