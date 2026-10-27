import type { Result } from "./awsCli";
import { awsJson } from "./awsCli";
import type { Evidence } from "./evidence";
import type { MetricSelector } from "./namespaces";

export interface CallerIdentity {
  Account?: string;
  Arn?: string;
}

export interface ResourceTagsStatus {
  Status?: string;
  AwsResourceExplorerManagedViewArn?: string;
}

export interface OTelStatus {
  Status?: string;
  IncludeFilters?: MetricSelector[];
  ExcludeFilters?: MetricSelector[];
  CreatedAt?: string | number;
  UpdatedAt?: string | number;
}

export interface AccountStatus {
  identity: Result<CallerIdentity>;
  resourceTags: Result<ResourceTagsStatus>;
  otel: Result<OTelStatus>;
}

export function readStatus(region: string): AccountStatus {
  return {
    identity: awsJson<CallerIdentity>(region, ["sts", "get-caller-identity"]),
    resourceTags: awsJson<ResourceTagsStatus>(region, [
      "observabilityadmin",
      "get-telemetry-enrichment-status",
    ]),
    otel: awsJson<OTelStatus>(region, ["cloudwatch", "get-o-tel-enrichment"]),
  };
}

export function isRunning(result: Result<{ Status?: string }>): boolean {
  return result.ok && result.value.Status?.toUpperCase() === "RUNNING";
}

export function accountProblem(
  identity: Result<CallerIdentity>,
  expected: string | undefined,
): string | undefined {
  if (!identity.ok) {
    return "Could not confirm the account with `aws sts get-caller-identity`. Not continuing.";
  }
  if (expected !== undefined && identity.value.Account !== expected) {
    return `The credentials are for account ${identity.value.Account ?? "unknown"}, not ${expected}. Not continuing.`;
  }
  return undefined;
}

export function stateProblem(status: AccountStatus): string | undefined {
  const unreadable = [
    { name: "resource tags on telemetry", result: status.resourceTags },
    { name: "OTel enrichment", result: status.otel },
  ]
    .filter(({ result }) => !result.ok)
    .map(({ name }) => name);
  return unreadable.length
    ? `Could not read the state of ${unreadable.join(" or ")}. Not continuing.`
    : undefined;
}

function describeFilters(filters: MetricSelector[] | undefined): string {
  return filters?.length
    ? filters
        .map((filter) =>
          filter.MetricNames?.length
            ? `${filter.Namespace} (${filter.MetricNames.join(", ")})`
            : filter.Namespace,
        )
        .join(", ")
    : "none";
}

function firstErrorLine(error: string): string {
  return error.split("\n").find((text) => text.trim()) ?? error;
}

export function describeResult<T>(
  result: Result<T>,
  describe: (value: T) => string,
): string {
  return result.ok
    ? describe(result.value)
    : `error: ${firstErrorLine(result.error)}`;
}

export function reportStatus(
  evidence: Evidence,
  status: AccountStatus,
  heading: string,
): void {
  evidence.line(`## ${heading}`);
  evidence.line();
  evidence.table(
    ["Item", "Value"],
    [
      [
        "Caller",
        describeResult(
          status.identity,
          (identity) => `${identity.Account ?? "?"} ${identity.Arn ?? "?"}`,
        ),
      ],
      [
        "Resource tags on telemetry",
        describeResult(
          status.resourceTags,
          (value) => value.Status ?? "unknown",
        ),
      ],
      [
        "OTel enrichment",
        describeResult(status.otel, (value) => value.Status ?? "unknown"),
      ],
      [
        "OTel include filters",
        describeResult(status.otel, (value) =>
          describeFilters(value.IncludeFilters),
        ),
      ],
      [
        "OTel exclude filters",
        describeResult(status.otel, (value) =>
          describeFilters(value.ExcludeFilters),
        ),
      ],
      [
        "OTel created / updated",
        describeResult(
          status.otel,
          (value) =>
            `${String(value.CreatedAt ?? "-")} / ${String(value.UpdatedAt ?? "-")}`,
        ),
      ],
    ],
  );
}
