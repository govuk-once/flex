import { glob } from "node:fs/promises";
import path from "node:path";

import type { ValidatedGatewayConfig } from "@flex/service-gateway";
import { GatewayConfigSchema } from "@flex/service-gateway";
import { findProjectRoot } from "@flex/utils";
import { createJiti } from "jiti";
import type { ZodType } from "zod";
import { z } from "zod";

const jiti = createJiti(import.meta.url);

const projectRoot = findProjectRoot();

export function getServiceGatewayConfigs(): Promise<ValidatedGatewayConfig[]> {
  return loadModules({
    root: `${projectRoot}/platform/domains`,
    pattern: "*/gateway.config.ts",
    schema: GatewayConfigSchema,
  });
}

interface LoadModulesOptions<Config> {
  readonly root: string;
  readonly pattern: string;
  readonly schema: ZodType<Config>;
}

async function loadModules<Config>({
  root,
  pattern,
  schema,
}: LoadModulesOptions<Config>): Promise<Config[]> {
  const moduleSchema = z.object({ config: schema });

  const configs: Config[] = [];

  for await (const entry of glob(pattern, { cwd: root })) {
    const absolutePath = path.join(root, entry);

    try {
      const file = await jiti.import(absolutePath);

      configs.push(moduleSchema.parse(file).config);
    } catch (error) {
      throw new Error(`Failed to parse config: ${absolutePath}`, {
        cause: error,
      });
    }
  }

  return configs;
}
