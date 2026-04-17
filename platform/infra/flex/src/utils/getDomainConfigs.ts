import { glob } from "node:fs/promises";
import path from "node:path";

import { DomainConfigSchema, IacDomainConfig } from "@flex/sdk";
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
