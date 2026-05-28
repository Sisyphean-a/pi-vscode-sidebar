import type { ParsedSidebarCommand } from "./parse/parser.ts";
import { readExportPath, readLastAssistantText } from "./ui/readers.ts";
import type { CommandResult } from "../../view/protocol.ts";
import type { RpcCommand } from "../../shared/rpc-types.ts";

interface RpcResponseLike {
  success: boolean;
  error?: string;
  data?: unknown;
}

interface CreateDirectCommandFlowOptions {
  emitCommandError(message: string, restoreInput: string): void;
  emitCommandResult(data: CommandResult): void;
  executeIdleCommand(command: RpcCommand, correlationId: string | undefined): Promise<void>;
  reportCommandFailure(response: RpcResponseLike, correlationId: string | undefined): void;
  sendRpcCommand(command: RpcCommand, correlationId: string | undefined): Promise<RpcResponseLike>;
}

export interface DirectCommandFlow {
  run(parsed: ParsedSidebarCommand, correlationId: string | undefined): Promise<boolean>;
}

export function createDirectCommandFlow(
  options: CreateDirectCommandFlowOptions,
): DirectCommandFlow {
  return {
    async run(parsed, correlationId) {
      if (parsed.name === "new") {
        await options.executeIdleCommand({ type: "new_session" }, correlationId);
        return true;
      }
      if (parsed.name === "compact") {
        await options.executeIdleCommand(
          { type: "compact", customInstructions: parsed.tail || undefined },
          correlationId,
        );
        return true;
      }
      if (parsed.name === "clone") {
        await options.executeIdleCommand({ type: "clone" }, correlationId);
        return true;
      }
      if (parsed.name === "name") {
        return handleNameCommand(parsed, correlationId);
      }
      if (parsed.name === "copy") {
        await onCopyCommand(correlationId, parsed.rawInput);
        return true;
      }
      if (parsed.name === "export") {
        await onExportCommand(parsed.tail || undefined, correlationId, parsed.rawInput);
        return true;
      }
      return false;
    },
  };

  async function handleNameCommand(
    parsed: ParsedSidebarCommand,
    correlationId: string | undefined,
  ): Promise<boolean> {
    if (!parsed.tail) {
      options.emitCommandError("会话名称不能为空", parsed.rawInput);
      return true;
    }
    await options.executeIdleCommand(
      { type: "set_session_name", name: parsed.tail },
      correlationId,
    );
    return true;
  }

  async function onCopyCommand(correlationId: string | undefined, rawInput: string): Promise<void> {
    const response = await options.sendRpcCommand(
      { type: "get_last_assistant_text" },
      correlationId,
    );
    if (!response.success) {
      options.reportCommandFailure(response, correlationId);
      options.emitCommandError(response.error ?? "获取最后一条助手消息失败", rawInput);
      return;
    }

    const copyText = readLastAssistantText(response.data);
    if (!copyText) {
      options.emitCommandError("没有可复制的助手消息", rawInput);
      return;
    }

    options.emitCommandResult({
      status: "success",
      message: "已复制",
      copyText,
    });
  }

  async function onExportCommand(
    outputPath: string | undefined,
    correlationId: string | undefined,
    rawInput: string,
  ): Promise<void> {
    const response = await options.sendRpcCommand(
      { type: "export_html", outputPath },
      correlationId,
    );
    if (!response.success) {
      options.reportCommandFailure(response, correlationId);
      options.emitCommandError(response.error ?? "导出失败", rawInput);
      return;
    }

    const path = readExportPath(response.data);
    options.emitCommandResult({
      status: "success",
      message: path ? `已导出：${path}` : "已导出",
    });
  }
}
