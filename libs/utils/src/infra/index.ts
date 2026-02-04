import fs from "node:fs";
import path from "node:path";

export function findProjectRoot(startDir = process.cwd()) {
  let dir = startDir;

  while (dir !== path.parse(dir).root) {
    const pnpmFile = path.join(dir, "pnpm-workspace.yaml");
    if (fs.existsSync(pnpmFile)) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  throw new Error("Could not find pnpm-workspace.yaml file");
}

export function sanitiseStageName(value?: string) {
  if (!value) return undefined;

  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 12);
}
