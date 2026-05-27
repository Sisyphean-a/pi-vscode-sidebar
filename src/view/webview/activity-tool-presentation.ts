import { truncateText } from "./ui-text.ts";

export function resolveToolFamily(toolName: string): string {
  if (toolName === "exec_command") return "command";
  if (toolName.startsWith("codegraph_")) return "codegraph";
  if (
    toolName === "search_query" ||
    toolName === "image_query" ||
    toolName === "open" ||
    toolName === "click" ||
    toolName === "find"
  ) {
    return "web";
  }
  return "tool";
}

export function summarizeToolDetailSummary(toolName: string, argsText: string | undefined): string {
  if (toolName === "exec_command") {
    const command = readNamedArg(argsText, "cmd") ?? readNamedArg(argsText, "command");
    return command ? `查看 ${command} 参数` : "查看命令参数";
  }
  return "查看参数";
}

export function summarizeToolLabel(
  toolName: string,
  argsText: string | undefined,
  outputText?: string,
): string {
  const path = readNamedArg(argsText, "path") ?? readNamedArg(argsText, "filePath");
  const workdir =
    readNamedArg(argsText, "cwd") ??
    readNamedArg(argsText, "workdir") ??
    readNamedArg(argsText, "workingDirectory");
  const command = readNamedArg(argsText, "cmd") ?? readNamedArg(argsText, "command");
  const query =
    readNamedArg(argsText, "q") ??
    readNamedArg(argsText, "query") ??
    readNamedArg(argsText, "pattern");

  if (toolName === "read") return path ? `读取：${truncateText(path, 72)}` : "读取文件";
  if (toolName === "apply_patch") return "apply_patch";
  if (toolName === "exec_command") {
    if (workdir) return `bash：${truncateText(workdir, 72)}`;
    if (command) return `bash：${truncateText(command, 72)}`;
    const firstLine = readFirstNonEmptyLine(outputText);
    if (firstLine) return `bash：${truncateText(firstLine, 72)}`;
    return "bash";
  }
  if (toolName === "rg" || toolName === "grep" || toolName === "search") {
    return query ? `搜索：${truncateText(query, 72)}` : "搜索代码";
  }
  if (toolName === "open") return path ? `打开：${truncateText(path, 72)}` : "打开内容";
  if (toolName.includes("write") || toolName.includes("edit")) {
    return path ? `修改：${truncateText(path, 72)}` : `修改内容（${toolName}）`;
  }
  return toolName;
}

export function summarizeToolResultDetailSummary(toolName: string, output: string): string {
  if (toolName === "exec_command") return "查看命令输出";
  if (!output.trim()) return "查看结果";
  return "查看详情";
}

function readFirstNonEmptyLine(text: string | undefined): string | undefined {
  if (!text) return undefined;
  return text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
}

function readNamedArg(argsText: string | undefined, name: string): string | undefined {
  if (!argsText) return undefined;
  const matcher = new RegExp(`"${name}"\\s*:\\s*"([^"]+)"`);
  const quoted = argsText.match(matcher)?.[1];
  if (quoted) return quoted;
  const plain = argsText.match(new RegExp(`"${name}"\\s*:\\s*([^,}\\]]+)`))?.[1]?.trim();
  return plain?.replace(/^"|"$/g, "");
}
