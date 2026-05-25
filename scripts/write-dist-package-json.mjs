import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const distPackageJsonPath = path.join(distDir, "package.json");

mkdirSync(distDir, { recursive: true });
writeFileSync(
  distPackageJsonPath,
  `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`,
  "utf8",
);
