import { existsSync } from "node:fs";
import path from "node:path";

/**
 * True when `pnpm openapi:generate` has written specs to folder. It always
 * writes index.json, which the docs UI reads to find the specs, so a folder
 * without one has nothing to publish.
 */
export function hasGeneratedSpecs(folder: string): boolean {
  return existsSync(path.join(folder, "index.json"));
}
