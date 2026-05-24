import { accessSync, constants, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const WIN_EXECUTABLE_EXTENSIONS = [".cmd", ".exe", ".ps1"];
const PI_CLI_RELATIVE_PATH = [
  "node_modules",
  "@earendil-works",
  "pi-coding-agent",
  "dist",
  "cli.js",
];

export interface ResolvePiBinaryOptions {
  customPath?: string;
  platform?: string;
  home?: string;
  pathEnv?: string;
  appData?: string;
  localAppData?: string;
  workspaceDirs?: string[];
  access?: (path: string, mode: number) => void;
}

export interface ResolvePiRuntimeOptions extends ResolvePiBinaryOptions {
  readFile?: (path: string, encoding: "utf8") => string;
}

export interface ResolvedPiRuntime {
  executable: string;
  args: string[];
}

export function resolvePiBinary(options: ResolvePiBinaryOptions = {}): string {
  const platform = options.platform ?? process.platform;
  const home = options.home ?? process.env.HOME ?? process.env.USERPROFILE ?? "";
  const pathEnv = options.pathEnv ?? process.env.PATH ?? "";
  const workspaceDirs = options.workspaceDirs ?? [];
  const access = options.access ?? accessSync;
  const isWindows = platform === "win32";
  const names = isWindows ? WIN_EXECUTABLE_EXTENSIONS.map((ext) => `pi${ext}`) : ["pi"];
  const accessMode = isWindows ? constants.F_OK : constants.X_OK;

  if (options.customPath) {
    if (!isWindows) return options.customPath;
    const resolved = resolveWindowsExecutable(options.customPath, access);
    return resolved ?? options.customPath;
  }

  const workspaceCandidates = workspaceDirs.flatMap((dir) =>
    names.map((name) => join(dir, "node_modules", ".bin", name)),
  );
  const globalCandidates = isWindows
    ? windowsGlobalDirs(options).flatMap((dir) => names.map((name) => join(dir, name)))
    : [`${home}/.bun/bin/pi`, `${home}/.local/bin/pi`, `${home}/.npm-global/bin/pi`];

  for (const candidate of [...workspaceCandidates, ...globalCandidates]) {
    if (canAccess(access, candidate, accessMode)) return candidate;
  }

  for (const dir of pathEnv.split(isWindows ? ";" : ":")) {
    if (!dir) continue;
    for (const name of names) {
      const candidate = join(dir, name);
      if (canAccess(access, candidate, accessMode)) return candidate;
    }
  }

  return "pi";
}

export function resolvePiRuntime(options: ResolvePiRuntimeOptions = {}): ResolvedPiRuntime {
  const binary = resolvePiBinary(options);
  const platform = options.platform ?? process.platform;
  const isWindows = platform === "win32";

  if (!isWindows) {
    return { executable: binary, args: [] };
  }

  const extension = getLowerCaseExtension(binary);
  if (extension === ".exe") {
    return { executable: binary, args: [] };
  }
  if (extension === "" && binary === "pi") {
    return { executable: binary, args: [] };
  }

  const cliPath = resolvePiCliPath(binary, options);
  return {
    executable: resolveNodeExecutable(binary, options.access ?? accessSync, platform),
    args: [cliPath],
  };
}

function resolvePiCliPath(binary: string, options: ResolvePiRuntimeOptions): string {
  const launcherText = (options.readFile ?? readFileSync)(binary, "utf8");
  if (!launcherText.includes("pi-coding-agent") || !launcherText.includes("cli.js")) {
    throw new Error(`Unsupported Pi launcher format: ${binary}`);
  }

  const cliPath = join(dirname(binary), ...PI_CLI_RELATIVE_PATH);
  const access = options.access ?? accessSync;
  if (!canAccess(access, cliPath, constants.F_OK)) {
    throw new Error(`Pi launcher found at ${binary} but CLI entry is missing: ${cliPath}`);
  }

  return cliPath;
}

function resolveNodeExecutable(
  binary: string,
  access: (path: string, mode: number) => void,
  platform: string,
): string {
  const localNodeName = platform === "win32" ? "node.exe" : "node";
  const localNodePath = join(dirname(binary), localNodeName);
  const accessMode = platform === "win32" ? constants.F_OK : constants.X_OK;
  return canAccess(access, localNodePath, accessMode) ? localNodePath : "node";
}

function windowsGlobalDirs(options: ResolvePiBinaryOptions): string[] {
  const appData = options.appData ?? process.env.APPDATA ?? "";
  const localAppData = options.localAppData ?? process.env.LOCALAPPDATA ?? "";
  const dirs: string[] = [];
  if (appData) dirs.push(join(appData, "npm"));
  if (localAppData) dirs.push(join(localAppData, "pnpm"));
  return dirs;
}

function canAccess(
  access: (path: string, mode: number) => void,
  filePath: string,
  mode: number,
): boolean {
  try {
    access(filePath, mode);
    return true;
  } catch {
    return false;
  }
}

function resolveWindowsExecutable(
  filePath: string,
  access: (path: string, mode: number) => void,
): string | undefined {
  const separatorIndex = Math.max(filePath.lastIndexOf("\\"), filePath.lastIndexOf("/"));
  if (filePath.lastIndexOf(".") > separatorIndex) return undefined;

  for (const extension of WIN_EXECUTABLE_EXTENSIONS) {
    const candidate = `${filePath}${extension}`;
    if (canAccess(access, candidate, constants.F_OK)) return candidate;
  }
  return undefined;
}

function getLowerCaseExtension(filePath: string): string {
  const index = filePath.lastIndexOf(".");
  return index >= 0 ? filePath.slice(index).toLowerCase() : "";
}
