import type { ValidatedGatewayConfig } from "@flex/service-gateway";

import { getFlexParamName } from "./getEntry";

export function getServiceGatewayParamKeys(
  entries: readonly ValidatedGatewayConfig[],
) {
  return entries.flatMap(({ resources }) =>
    Object.values(resources).map(({ path }) => getFlexParamName(path)),
  );
}
