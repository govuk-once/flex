import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DOMAINS_ROOT = "domains";

export interface E2eModule {
  /** Domain directory name, used for the matrix job label. */
  name: string;
  /** Workspace package name, used as the pnpm --filter target. */
  package: string;
}

/**
 * Discovers every domain that declares a `test:e2e` script, returning the data
 * the CI matrix needs to fan a job out per domain.
 *
 * A malformed `package.json` in one domain is skipped (with a warning) rather
 * than thrown, so a single broken manifest cannot break discovery for the rest.
 */
export function listE2eModules(domainsRoot = DOMAINS_ROOT): E2eModule[] {
  const modules: E2eModule[] = [];

  for (const name of readdirSync(domainsRoot).sort()) {
    const manifestPath = path.join(domainsRoot, name, "package.json");
    if (!existsSync(manifestPath)) continue;

    let manifest: { name?: string; scripts?: Record<string, string> };
    try {
      manifest = JSON.parse(
        readFileSync(manifestPath, "utf8"),
      ) as typeof manifest;
    } catch (error) {
      console.warn(
        `Skipping ${manifestPath}: failed to parse package.json (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
      continue;
    }

    if (manifest.name && manifest.scripts?.["test:e2e"]) {
      modules.push({ name, package: manifest.name });
    }
  }

  return modules;
}

// When executed directly, emit the JSON array for the CI matrix to consume on
// stdout. Warnings go to stderr, so captured stdout stays clean JSON.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(JSON.stringify(listE2eModules()));
}
