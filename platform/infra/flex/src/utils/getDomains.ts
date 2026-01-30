/**
 * Hard coding in hello domain for now need to make this dynamic
 * jiti doesn't allow * so will need to get them some other way
 *
 * TODO:
 * - Get all stacks during deployment, as the moment only using hello domain
 * - make IDomainEndpoints into Zod schema
 */
import { IRoutes } from "@flex/iac";
import createJiti from "jiti";

interface IDomainEndpoints {
  endpoints: IRoutes;
}

export async function loadDomainConfigs(): Promise<IRoutes[]> {
  const jiti = createJiti(import.meta.url);

  try {
    const domain: IDomainEndpoints = await jiti.import(
      "../../../../../domains/hello/src/domain.config.ts",
    );

    return [domain.endpoints] as IRoutes[];
  } catch (e) {
    console.error(e);
    throw new Error();
  }
}
