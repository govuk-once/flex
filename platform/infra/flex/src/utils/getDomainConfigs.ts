import fs from "node:fs";
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

interface LegacyDomainConfigs {
  public: IDomain;
  private?: IDomain;
}

// TODO: Return single list of domains when poc migration is complete
interface DomainConfigs {
  endpoints: LegacyDomainConfigs[];
  poc: IacDomainConfig[];
}

export async function getDomainConfigs(): Promise<DomainConfigs> {
  const domains: DomainConfigs = { endpoints: [], poc: [] };

  for await (const entry of glob("*/domain.config.ts", { cwd: domainsRoot })) {
    const absolutePath = path.join(domainsRoot, entry);

    const file = await jiti.import<
      { config: IacDomainConfig } | { endpoints: IDomain }
    >(absolutePath);

    if ("config" in file) {
      const { data, error } = DomainConfigSchema.safeParse(file.config);

      if (error) throw new Error(`Invalid domain config: ${absolutePath}`);

      domains.poc.push(data);
      continue;
    }

    const { data, error } = configModuleSchema.safeParse(file);

    if (error) throw new Error(`Invalid domain config: ${absolutePath}`);

    domains.endpoints.push({
      public: data.endpoints,
      private: await loadDomainPrivateConfig(path.dirname(absolutePath)),
    });
  }

  return domains;
}

async function loadDomainPrivateConfig(dir: string) {
  const file = path.join(dir, "domain.private.config.ts");

  if (!fs.existsSync(file)) return;

  const { data, error } = configModuleSchema.safeParse(
    await jiti.import<IDomain>(file),
  );

  if (error) throw new Error(`Invalid domain config: ${file}`);

  return data.endpoints;
}
