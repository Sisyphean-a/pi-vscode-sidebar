import { describe, expect, it } from "vitest";
import {
  findBuiltinSidebarCommand,
  listLocalizedBuiltinSidebarCommands,
} from "../../../src/shared/sidebar-command-builtins.ts";

describe("sidebar command builtins", () => {
  it("finds builtin commands by normalized id", () => {
    expect(findBuiltinSidebarCommand("  MoDeL  ")).toMatchObject({
      id: "model",
      name: "model",
    });
  });

  it("localizes builtin descriptions without changing slash command names", () => {
    expect(
      listLocalizedBuiltinSidebarCommands("zh").find((command) => command.id === "model"),
    ).toEqual({
      id: "model",
      name: "model",
      description: "选择模型（会打开选择器）",
      source: "builtin",
      aliases: ["model"],
    });
  });
});
