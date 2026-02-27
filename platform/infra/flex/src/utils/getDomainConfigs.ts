import { glob } from "node:fs/promises";
import path from "node:path";

import {
  DomainConfigSchema,
  domainSchema,
  IacDomainConfig,
  IDomain,
} from "@flex/sdk";
import { findProjectRoot } from "@flex/utils";
import { createJiti } from "jiti";
import z from "zod";

const configModuleSchema = z.object({
  endpoints: domainSchema,
});

const jiti = createJiti(import.meta.url);

const domainsRoot = `${findProjectRoot()}/domains`;

// TODO: Return single list of domains when poc migration is complete
interface DomainConfigs {
  endpoints: IDomain[];
  poc: IacDomainConfig[];
}

export async function getDomainConfigs(): Promise<DomainConfigs> {
  const domains: DomainConfigs = { endpoints: [], poc: [] };

  for await (const entry of glob("*/domain.config.ts", { cwd: domainsRoot })) {
    const absolutePath = path.join(domainsRoot, entry);

    const configModule = await jiti.import<
      { config: IacDomainConfig } | { endpoints: IDomain }
    >(absolutePath);

    if ("config" in configModule) {
      const { data, error } = DomainConfigSchema.safeParse(configModule.config);

      if (error) {
        throw new Error(`Invalid domain config: ${absolutePath}`);
      }

      domains.poc.push(data);
    } else {
      const { data, error } = configModuleSchema.safeParse(configModule);

      if (error) {
        throw new Error(`Invalid domain config: ${absolutePath}`);
      }

      domains.endpoints.push(data.endpoints);
    }
  }

  return domains;
}
