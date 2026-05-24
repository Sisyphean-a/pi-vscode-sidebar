import { describe, expect, it } from "vitest";
import { resolvePiRuntime } from "../../../src/pi/resolve.ts";

describe("resolvePiRuntime", () => {
  it("maps a windows launcher to node and cli.js", () => {
    const runtime = resolvePiRuntime({
      platform: "win32",
      customPath: "C:\\tools\\pi.cmd",
      readFile() {
        return '@ECHO off\r\n"%_prog%"  "C:\\tools\\node_modules\\@earendil-works\\pi-coding-agent\\dist\\cli.js" %*';
      },
      access(filePath) {
        if (filePath === "C:\\tools\\node.exe") return;
        if (filePath === "C:\\tools\\node_modules\\@earendil-works\\pi-coding-agent\\dist\\cli.js")
          return;
        throw new Error(`missing: ${filePath}`);
      },
    });

    expect(runtime).toEqual({
      executable: "C:\\tools\\node.exe",
      args: ["C:\\tools\\node_modules\\@earendil-works\\pi-coding-agent\\dist\\cli.js"],
    });
  });
});
