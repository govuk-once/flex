import type { IntegrationViolation } from "@flex/sdk";
import { validateDomainIntegrations } from "@flex/sdk";

import { getDomainConfigs } from "../utils/getDomainConfigs";

function formatViolation(violation: IntegrationViolation): string {
  const { sourceDomain, integrationKey, targetDomain, route, reason } =
    violation;

  if (reason === "target-not-found") {
    return `[${sourceDomain}] integration "${integrationKey}" -> target domain "${targetDomain}" not found`;
  }

  return `[${sourceDomain}] integration "${integrationKey}" -> target "${targetDomain}": no private route matches "${route}" (route may have been removed or made public-only)`;
}

async function main(): Promise<number> {
  const configs = await getDomainConfigs();
  const violations = validateDomainIntegrations(configs);

  if (violations.length === 0) {
    console.log(
      "All domain integrations resolve to a private route in their target domain.",
    );
    return 0;
  }

  console.log(
    `Found ${String(violations.length)} unresolved domain integration(s):`,
  );
  violations.forEach((violation) => {
    console.log(`- ${formatViolation(violation)}`);
  });

  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
