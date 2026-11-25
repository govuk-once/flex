import { describeError } from "./lib/otelMetrics/awsCli";
import { collect } from "./lib/otelMetrics/commands/collect";
import { cost } from "./lib/otelMetrics/commands/cost";
import { disable } from "./lib/otelMetrics/commands/disable";
import { enable } from "./lib/otelMetrics/commands/enable";
import { preflight } from "./lib/otelMetrics/commands/preflight";
import type { Evidence } from "./lib/otelMetrics/evidence";
import { createEvidence } from "./lib/otelMetrics/evidence";
import type { Command, Options } from "./lib/otelMetrics/options";
import { parseOptions, USAGE } from "./lib/otelMetrics/options";

const HANDLERS: Record<
  Command,
  (options: Options, evidence: Evidence) => number | Promise<number>
> = {
  preflight,
  enable,
  collect,
  cost,
  disable,
};

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    return 0;
  }
  const options = parseOptions(argv);
  const evidence = createEvidence(options.out, options.command);
  return HANDLERS[options.command](options, evidence);
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(describeError(error));
    process.exit(2);
  });
