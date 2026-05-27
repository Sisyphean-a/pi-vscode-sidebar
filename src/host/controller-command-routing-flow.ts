import { findBuiltinSidebarCommand } from "../shared/sidebar-commands.ts";
import type { CommandResult } from "../view/protocol.ts";
import type { ParsedSidebarCommand } from "./commands/parser.ts";
import { normalizeParsedSidebarCommand } from "./controller-command-ui.ts";
import type { CommandUiFlow } from "./controller-command-ui-flow.ts";
import type { DirectCommandFlow } from "./controller-direct-command-flow.ts";
import type { ControllerRpcFlow } from "./controller-rpc-flow.ts";

interface CreateCommandRoutingFlowOptions {
  commandUiFlow: Pick<CommandUiFlow, "open">;
  directCommandFlow: Pick<DirectCommandFlow, "run">;
  emitCommandResult(data: CommandResult): void;
  rpcFlow: Pick<ControllerRpcFlow, "findDynamicSlashCommand" | "onPromptSlashCommand">;
}

export interface CommandRoutingFlow {
  run(commandName: string, rawInput: string, correlationId: string | undefined): Promise<void>;
}

export function createCommandRoutingFlow(
  options: CreateCommandRoutingFlowOptions,
): CommandRoutingFlow {
  return {
    async run(commandName, rawInput, correlationId) {
      const parsed = normalizeParsedSidebarCommand(commandName, rawInput);
      if (!parsed) {
        options.emitCommandResult({ status: "error", restoreInput: rawInput });
        return;
      }

      if (await options.directCommandFlow.run(parsed, correlationId)) return;
      if (await options.commandUiFlow.open(parsed.name, parsed.rawInput, correlationId)) return;
      if (await runDynamicSidebarCommand(parsed, correlationId)) return;

      options.emitCommandResult({
        status: "error",
        message: `未实现命令：/${parsed.name}`,
        restoreInput: rawInput,
      });
    },
  };

  async function runDynamicSidebarCommand(
    parsed: ParsedSidebarCommand,
    correlationId: string | undefined,
  ): Promise<boolean> {
    if (findBuiltinSidebarCommand(parsed.name)) return false;
    const command = await options.rpcFlow.findDynamicSlashCommand(parsed.name, correlationId);
    if (!command) return false;
    await options.rpcFlow.onPromptSlashCommand(parsed.rawInput, correlationId);
    return true;
  }
}
