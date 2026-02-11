import { glob } from "node:fs/promises";
import path from "node:path";

import { IDomainConfig } from "@flex/sdk";
import { findProjectRoot } from "@flex/utils";
import { createJiti } from "jiti";

interface IDomainEndpoints {
  endpoints: IDomainConfig;
}

export async function loadDomainConfigs(): Promise<IDomainConfig[]> {
  const jiti = createJiti(import.meta.url);
  const domainsRoot = `${findProjectRoot()}/domains`;

  const results: IDomainConfig[] = [];

  for await (const entry of glob("*/domain.config.ts", {
    cwd: domainsRoot,
  })) {
    const absolutePath = path.join(domainsRoot, entry);
    const domain: IDomainEndpoints = await jiti.import(absolutePath);
    results.push(domain.endpoints);
  }

  return results;
}
