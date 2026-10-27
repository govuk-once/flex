import { sameFilters } from "../analysis";
import { awsJson } from "../awsCli";
import type { Evidence } from "../evidence";
import type { EnabledMarker } from "../history";
import { ENABLED_MARKER } from "../history";
import { includeFiltersFor } from "../namespaces";
import type { Options } from "../options";
import type { OTelStatus } from "../status";
import {
  accountProblem,
  isRunning,
  readStatus,
  reportStatus,
  stateProblem,
} from "../status";

const POLL_INTERVAL_MS = 15_000;
const POLL_LIMIT_MS = 10 * 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForResourceTags(
  region: string,
  evidence: Evidence,
): Promise<boolean> {
  const deadline = Date.now() + POLL_LIMIT_MS;
  while (Date.now() < deadline) {
    const status = awsJson<{ Status?: string }>(region, [
      "observabilityadmin",
      "get-telemetry-enrichment-status",
    ]);
    const value = status.ok
      ? (status.value.Status ?? "unknown")
      : `error: ${status.error}`;
    evidence.line(
      `- ${new Date().toISOString()} resource tags on telemetry: ${value}`,
    );
    if (isRunning(status)) return true;
    if (value.toUpperCase() === "IMPAIRED") return false;
    await sleep(POLL_INTERVAL_MS);
  }
  return false;
}

export async function enable(
  options: Options,
  evidence: Evidence,
): Promise<number> {
  if (!options.mode) {
    evidence.line("enable needs --mode all or --mode scoped.");
    evidence.finish();
    return 2;
  }
  const filters = includeFiltersFor(options.mode);
  const before = readStatus(options.region);
  evidence.save("status-before.json", before);

  evidence.line(
    `# OTel metrics spike: enable (${options.mode}, ${options.region})`,
  );
  evidence.line();
  evidence.line(
    `Run at ${new Date().toISOString()}. ${options.apply ? "APPLY" : "DRY RUN, nothing changed"}.`,
  );
  evidence.line();
  reportStatus(evidence, before, "Before");

  evidence.line("## Plan");
  evidence.line();
  evidence.line(
    isRunning(before.resourceTags)
      ? "- Resource tags on telemetry is already running; leave it."
      : "- `aws observabilityadmin start-telemetry-enrichment`, then wait for `Running`.",
  );
  const filterPlan = filters.length
    ? " with include filters " + JSON.stringify(filters)
    : " with no filters (every supported namespace)";
  evidence.line(`- \`aws cloudwatch start-o-tel-enrichment\`${filterPlan}.`);
  evidence.line();

  if (isRunning(before.otel)) {
    evidence.line(
      "OTel enrichment is already running in this account and region. Not changing it: find out who turned it on, and record its filters above. `collect` can still run.",
    );
    evidence.finish();
    return 1;
  }
  const problem =
    accountProblem(before.identity, options.account) ?? stateProblem(before);
  if (problem || !before.identity.ok) {
    evidence.line(problem);
    evidence.finish();
    return 2;
  }
  if (!options.apply) {
    evidence.line("Dry run. Re-run with --apply to make these changes.");
    evidence.finish();
    return 0;
  }

  evidence.line("## Progress");
  evidence.line();
  if (!isRunning(before.resourceTags)) {
    const started = awsJson<unknown>(options.region, [
      "observabilityadmin",
      "start-telemetry-enrichment",
    ]);
    evidence.save("start-telemetry-enrichment.json", started);
    if (!started.ok) {
      evidence.line(`start-telemetry-enrichment failed: ${started.error}`);
      evidence.finish();
      return 1;
    }
    const running = await waitForResourceTags(options.region, evidence);
    if (!running) {
      evidence.line(
        "Resource tags on telemetry did not reach Running. Not starting OTel enrichment.",
      );
      evidence.finish();
      return 1;
    }
  }

  const startArgs = filters.length
    ? ["--include-filters", JSON.stringify(filters)]
    : [];
  const started = awsJson<OTelStatus>(options.region, [
    "cloudwatch",
    "start-o-tel-enrichment",
    ...startArgs,
  ]);
  evidence.save("start-o-tel-enrichment.json", started);
  if (!started.ok) {
    evidence.line(`start-o-tel-enrichment failed: ${started.error}`);
    evidence.finish();
    return 1;
  }
  const marker: EnabledMarker = {
    account: before.identity.value.Account ?? "",
    region: options.region,
    mode: options.mode,
    startedResourceTags: !isRunning(before.resourceTags),
    startedAt: new Date().toISOString(),
  };
  evidence.save(ENABLED_MARKER, marker);
  evidence.line(
    `- Recorded in \`${ENABLED_MARKER}\` that this run started OTel enrichment${marker.startedResourceTags ? " and resource tags" : ""}, so \`disable\` will stop it.`,
  );
  evidence.line(
    sameFilters(filters, started.value.IncludeFilters)
      ? "- start-o-tel-enrichment returned the filters that were sent."
      : `- start-o-tel-enrichment returned different filters (${JSON.stringify(started.value.IncludeFilters ?? [])}). Enrichment was probably already running and the request was ignored.`,
  );
  evidence.line();

  const after = readStatus(options.region);
  evidence.save("status-after.json", after);
  reportStatus(evidence, after, "After");
  evidence.line(
    `Enabled at ${new Date().toISOString()}. Data takes a few minutes to appear; run \`collect\` after there has been traffic.`,
  );
  evidence.finish();
  return isRunning(after.otel) ? 0 : 1;
}
