import { glob } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { IRoutes } from "@flex/iac";
import createJiti from "jiti";

interface IDomainEndpoints {
  endpoints: IRoutes;
}

export async function loadDomainConfigs(): Promise<IRoutes[]> {
  const jiti = createJiti(import.meta.url);

  const __dirName = path.dirname(fileURLToPath(import.meta.url));
  const domainsRoot = path.resolve(__dirName, "../../../../../domains");

  try {
    const results: IRoutes[] = [];

    for await (const entry of glob("*/src/domain.config.ts", {
      cwd: domainsRoot,
    })) {
      const absolutePath = path.join(domainsRoot, entry);
      const domain: IDomainEndpoints = await jiti.import(absolutePath);
      results.push(domain.endpoints);
    }

    return results;
  } catch (e) {
    console.error(e);
    throw new Error();
  }
}
