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

const jiti = createJiti(import.meta.url);
const domainsRoot = `${findProjectRoot()}/domains`;

async function loadDomainConfig<T extends z.ZodType>(
  schema: T,
  domain: string,
  filename?: string,
): Promise<z.infer<T> | undefined> {
  try {
    const filepath = filename ? path.join(domain, filename) : domain;

    const file = await jiti.import(filepath);
    const parseResult = schema.safeParse(file);

    return parseResult.success ? parseResult.data : undefined;
  } catch {
    return;
  }
}

/**
 * Legacy config loader
 */

interface LegacyDomainConfigs {
  publicDomain: IDomain;
  privateDomain?: IDomain;
}

const legacySchema = z.object({
  endpoints: domainSchema,
});

export async function getLegacyDomainConfigs() {
  const domains: LegacyDomainConfigs[] = [];

  for await (const entry of glob("*/domain.config.ts", { cwd: domainsRoot })) {
    const domainDir = path.dirname(path.join(domainsRoot, entry));

    const [publicConfig, privateConfig] = await Promise.all([
      loadDomainConfig(legacySchema, domainDir, "domain.config.ts"),
      loadDomainConfig(legacySchema, domainDir, "domain.private.config.ts"),
    ]);

    if (!publicConfig) continue;

    domains.push({
      publicDomain: publicConfig.endpoints,
      privateDomain: privateConfig?.endpoints,
    });
  }

  return domains;
}

/**
 * Config loader
 */

const configSchema = z.object({
  config: DomainConfigSchema,
});

export async function getDomainConfigs() {
  const domains: IacDomainConfig[] = [];

  for await (const entry of glob("*/domain.config.ts", { cwd: domainsRoot })) {
    const absolutePath = path.join(domainsRoot, entry);
    const config = await loadDomainConfig(configSchema, absolutePath);

    if (!config) continue;

    domains.push(config.config);
  }

  return domains;
}
