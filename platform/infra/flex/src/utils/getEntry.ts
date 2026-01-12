import fs from "node:fs";
import path from "node:path";

function findRoot(startDir = process.cwd()) {
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

export function getEntry(domain: string, path: string) {
  // /domains/hello/src/handlers/hello/get.ts
  return `${findRoot()}/domains/${domain}/src/${path}`;
}
