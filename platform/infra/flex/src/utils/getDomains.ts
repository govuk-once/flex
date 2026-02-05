import { glob } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { IDomain } from "@flex/config/domain";
import { createJiti } from "jiti";

interface IDomainEndpoints {
  endpoints: IDomain;
}

export async function loadDomainConfigs(): Promise<IDomain[]> {
  const jiti = createJiti(import.meta.url);

  const __dirName = path.dirname(fileURLToPath(import.meta.url));
  const domainsRoot = path.resolve(__dirName, "../../../../../domains");

  try {
    const results: IDomain[] = [];

    for await (const entry of glob("*/domain.config.ts", {
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
