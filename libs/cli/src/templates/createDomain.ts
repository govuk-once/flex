import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Mustache from "mustache";

import { findDomainPath } from "../utils/findDomainPath";

const srcDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "./domain",
);

export async function createDomain(domain: string): Promise<void> {
  const outDir = findDomainPath(domain);
  await fs.mkdir(outDir, { recursive: true });

  async function walk(currentSrc: string): Promise<void> {
    const entries = await fs.readdir(currentSrc, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(currentSrc, entry.name);
      const relPath = path.relative(srcDir, srcPath);

      if (entry.isDirectory()) {
        const targetDir = path.join(outDir, relPath);
        await fs.mkdir(targetDir, { recursive: true });
        await walk(srcPath);
      } else if (entry.isFile() && entry.name.endsWith(".mustache")) {
        const outPath = path.join(outDir, relPath.replace(/\.mustache$/, ""));

        const template = await fs.readFile(srcPath, "utf8");
        const rendered = Mustache.render(template, { domain });

        await fs.mkdir(path.dirname(outPath), { recursive: true });
        await fs.writeFile(outPath, rendered, "utf8");
      }
    }
  }

  await walk(srcDir);
}
