import { glob } from "node:fs/promises";
import path from "node:path";

import { domainSchema, IDomain } from "@flex/sdk";
import { findProjectRoot } from "@flex/utils";
import { createJiti } from "jiti";
import z from "zod";

const configModuleSchema = z.object({
  endpoints: domainSchema,
});

const jiti = createJiti(import.meta.url);
const domainsRoot = `${findProjectRoot()}/domains`;

const loadDomainConfigs = async (pattern: string): Promise<IDomain[]> => {
  const results: IDomain[] = [];
  for await (const entry of glob(pattern, { cwd: domainsRoot })) {
    const absolutePath = path.join(domainsRoot, entry);
    const configModule = await jiti.import(absolutePath);
    const { success, data } = configModuleSchema.safeParse(configModule);

    if (!success) {
      throw new Error(`Config invalid: ${absolutePath}`);
    }
    results.push(data.endpoints);
  }
  return results;
};

export async function getDomainConfigs(): Promise<IDomain[]> {
  return loadDomainConfigs("*/domain.config.ts");
}

/**
 * Returns a Map of domain name to private config
 */
export async function getPrivateDomainConfigs(): Promise<Map<string, IDomain>> {
  const privateConfigs = await loadDomainConfigs("*/domain.private.config.ts");
  return new Map(privateConfigs.map((config) => [config.domain, config]));
}
