import { appendFileSync } from "node:fs";

import { macieCoverage } from "../macie-coverage";
import { getDomainConfigs } from "../utils/getDomainConfigs";

const COVERAGE_CONFIG_PATH = "platform/infra/flex/src/macie-coverage.ts";

function emitOutput(uncovered: string[]): void {
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (!githubOutput) return;
  appendFileSync(githubOutput, `uncovered=${uncovered.join(",")}\n`);
}

async function main(): Promise<number> {
  const configs = await getDomainConfigs();
  const scannedDomains = configs
    .map((config) => config.name)
    .sort((a, b) => a.localeCompare(b));

  const covered = new Set(macieCoverage.coveredDomains);
  const uncovered = scannedDomains.filter((name) => !covered.has(name));
  const stale = macieCoverage.coveredDomains.filter(
    (name) => !scannedDomains.includes(name),
  );

  stale.forEach((name) => {
    console.log(
      `warning: stale entry "${name}" in ${COVERAGE_CONFIG_PATH}, no matching domain found, remove it`,
    );
  });

  emitOutput(uncovered);

  if (uncovered.length === 0) {
    console.log(
      `All ${String(scannedDomains.length)} domain(s) are listed in the Macie coverage config.`,
    );
    return 0;
  }

  console.log(
    `warning: ${String(uncovered.length)} domain(s) not covered by the Macie assessment:`,
  );
  uncovered.forEach((name) => {
    console.log(
      `- ${name}: not assessed for Macie coverage. Review the data it handles, add any unmanaged PII format to customDataIdentifiers, then list it in coveredDomains in ${COVERAGE_CONFIG_PATH}`,
    );
  });

  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
