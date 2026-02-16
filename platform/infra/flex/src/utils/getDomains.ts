import { glob } from "node:fs/promises";
import path from "node:path";

import { IDomain } from "@flex/sdk";
import { findProjectRoot } from "@flex/utils";
import { createJiti } from "jiti";

interface IDomainEndpoints {
  endpoints: IDomain;
}

export async function loadDomainConfigs(): Promise<IDomain[]> {
  const jiti = createJiti(import.meta.url, {
    rebuildFsCache: true,
  });
  const domainsRoot = `${findProjectRoot()}/domains`;

  const results: IDomain[] = [];

  for await (const entry of glob("*/domain.config.ts", {
    cwd: domainsRoot,
  })) {
    const absolutePath = path.join(domainsRoot, entry);
    const domain: IDomainEndpoints = await jiti.import(absolutePath);
    results.push(domain.endpoints);
  }

  return results;
}
