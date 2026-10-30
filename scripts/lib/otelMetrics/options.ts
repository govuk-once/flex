import { readFlag } from "../args";
import type { EnrichmentMode } from "./namespaces";
import { ENRICHMENT_MODES } from "./namespaces";
import type { ApiTarget } from "./queries";

export const COMMANDS = [
  "preflight",
  "enable",
  "collect",
  "cost",
  "disable",
] as const;

export type Command = (typeof COMMANDS)[number];

export interface Options {
  command: Command;
  region: string;
  out: string;
  apply: boolean;
  mode?: EnrichmentMode;
  stage?: string;
  account?: string;
  hours: number;
  days: number;
  stopResourceTags: boolean;
  force: boolean;
  api: ApiTarget;
}

const DEFAULTS = {
  region: "eu-west-2",
  out: "otel-metrics-evidence",
  hours: 3,
  days: 3,
  apiName: "Api",
  apiStage: "prod",
  method: "GET",
  resource: "/app/dvla/v1/vehicle-enquiry/{reg}",
};

export const USAGE = `Usage: pnpm otel:spike <command> [options]

Commands:
  preflight   Read-only. Caller, tool versions, current enrichment state,
              Resource Explorer indexes, series counts and a cost ceiling.
  enable      Turn on resource tags on telemetry, then OTel enrichment.
              Dry run unless --apply. Requires --mode all|scoped, and
              --account with --apply.
  collect     Read-only, PromQL API calls are charged per sample scanned.
              Labels, re-graph of one API Gateway latency widget against the
              classic metric, Lambda by domain, Metrics Insights comparison.
              Requires --stage.
  cost        Cost Explorer CloudWatch usage by usage type (each call costs
              $0.01).
  disable     Stop OTel enrichment started by this script's enable, and
              resource tags on telemetry only with --stop-resource-tags.
              Dry run unless --apply. Requires --account with --apply.

Options:
  --region <region>        Default AWS_REGION, then ${DEFAULTS.region}
  --out <dir>              Evidence root, default ./${DEFAULTS.out}
  --apply                  Make the change (enable, disable)
  --account <id>           enable, disable: the 12-digit account to change;
                           refused unless it matches the current credentials
  --mode all|scoped        enable: scoped is AWS/Lambda and AWS/ApiGateway only
  --stage <stage>          collect: value of the Stage tag to query
  --hours <n>              collect: window ending 10 minutes ago, default ${String(DEFAULTS.hours)}
  --days <n>               cost: days back from today, default ${String(DEFAULTS.days)}
  --stop-resource-tags     disable: also stop resource tags on telemetry
  --force                  disable: stop OTel enrichment even when no
                           enable --apply for this account and region is
                           recorded under --out
  --api-name <name>        collect: default ${DEFAULTS.apiName}
  --api-stage <stage>      collect: API Gateway stage, default ${DEFAULTS.apiStage}
  --method <method>        collect: default ${DEFAULTS.method}
  --resource <path>        collect: default ${DEFAULTS.resource}
`;

function isCommand(value: string | undefined): value is Command {
  return COMMANDS.some((command) => command === value);
}

function isMode(value: string): value is EnrichmentMode {
  return ENRICHMENT_MODES.some((mode) => mode === value);
}

const VALUE_FLAGS = [
  "--region",
  "--out",
  "--mode",
  "--stage",
  "--account",
  "--hours",
  "--days",
  "--api-name",
  "--api-stage",
  "--method",
  "--resource",
];

const SWITCH_FLAGS = ["--apply", "--stop-resource-tags", "--force"];

function unknownArguments(argv: string[]): string[] {
  const rest = argv.slice(1);
  return rest.filter(
    (token, index) =>
      !VALUE_FLAGS.includes(rest[index - 1] ?? "") &&
      !VALUE_FLAGS.includes(token) &&
      !SWITCH_FLAGS.includes(token),
  );
}

function positiveNumber(
  flag: string,
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive number; received "${value}"`);
  }
  return parsed;
}

function parseMode(value: string | undefined): EnrichmentMode | undefined {
  if (value === undefined) return undefined;
  if (!isMode(value)) {
    throw new Error(
      `--mode must be one of ${ENRICHMENT_MODES.join(", ")}; received "${value}"`,
    );
  }
  return value;
}

function parseStage(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!/^[A-Za-z0-9-]+$/.test(value)) {
    throw new Error(
      `--stage may contain only letters, digits and hyphens; received "${value}"`,
    );
  }
  return value;
}

function parseAccount(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{12}$/.test(value)) {
    throw new Error(
      `--account must be a 12-digit AWS account ID; received "${value}"`,
    );
  }
  return value;
}

const MAX_HOURS = 5 * 24;

const REQUIREMENTS: {
  applies: (options: Options) => boolean;
  message: string;
}[] = [
  {
    applies: (options) => options.command === "enable" && !options.mode,
    message: "enable needs --mode all or --mode scoped.",
  },
  {
    applies: (options) => options.command === "collect" && !options.stage,
    message: "collect needs --stage <stage>, the value of the Stage tag.",
  },
  {
    applies: (options) => options.apply && !options.account,
    message:
      "--apply needs --account <id>, the 12-digit account you mean to change.",
  },
  {
    applies: (options) => options.hours > MAX_HOURS,
    message: `--hours can be at most ${String(MAX_HOURS)}; classic GetMetricStatistics returns at most 1,440 five-minute points.`,
  },
];

export function parseOptions(argv: string[]): Options {
  const [command] = argv;
  if (!isCommand(command)) {
    throw new Error(
      `Unknown or missing command "${command ?? ""}"\n\n${USAGE}`,
    );
  }
  const unknown = unknownArguments(argv);
  if (unknown.length > 0) {
    throw new Error(
      `Unknown arguments: ${unknown.join(" ")}. Choose the account with AWS_PROFILE, not a flag.\n\n${USAGE}`,
    );
  }
  const options: Options = {
    command,
    region:
      readFlag(argv, "--region") ?? (process.env.AWS_REGION || DEFAULTS.region),
    out: readFlag(argv, "--out") ?? DEFAULTS.out,
    apply: argv.includes("--apply"),
    mode: parseMode(readFlag(argv, "--mode")),
    stage: parseStage(readFlag(argv, "--stage")),
    account: parseAccount(readFlag(argv, "--account")),
    hours: positiveNumber("--hours", readFlag(argv, "--hours"), DEFAULTS.hours),
    days: positiveNumber("--days", readFlag(argv, "--days"), DEFAULTS.days),
    stopResourceTags: argv.includes("--stop-resource-tags"),
    force: argv.includes("--force"),
    api: {
      apiName: readFlag(argv, "--api-name") ?? DEFAULTS.apiName,
      apiStage: readFlag(argv, "--api-stage") ?? DEFAULTS.apiStage,
      method: readFlag(argv, "--method") ?? DEFAULTS.method,
      resource: readFlag(argv, "--resource") ?? DEFAULTS.resource,
    },
  };
  REQUIREMENTS.filter((requirement) => requirement.applies(options)).forEach(
    (requirement) => {
      throw new Error(`${requirement.message}\n\n${USAGE}`);
    },
  );
  return options;
}
