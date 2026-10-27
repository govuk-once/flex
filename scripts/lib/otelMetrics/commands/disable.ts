import type { Result } from "../awsCli";
import { awsJson } from "../awsCli";
import type { Evidence } from "../evidence";
import { ENABLED_MARKER, findEnabledMarker } from "../history";
import type { Options } from "../options";
import type { AccountStatus } from "../status";
import {
  accountProblem,
  isRunning,
  readStatus,
  reportStatus,
  stateProblem,
} from "../status";

interface Setting {
  name: string;
  stop: boolean;
  args: string[];
  after: (status: AccountStatus) => Result<{ Status?: string }>;
}

function stillOn(result: Result<{ Status?: string }>): boolean {
  return !result.ok || isRunning(result);
}

export function disable(options: Options, evidence: Evidence): number {
  const before = readStatus(options.region);
  evidence.save("status-before.json", before);

  evidence.line(`# OTel metrics spike: disable (${options.region})`);
  evidence.line();
  evidence.line(
    `Run at ${new Date().toISOString()}. ${options.apply ? "APPLY" : "DRY RUN, nothing changed"}.`,
  );
  evidence.line();
  reportStatus(evidence, before, "Before");

  const problem =
    accountProblem(before.identity, options.account) ?? stateProblem(before);
  if (problem || !before.identity.ok) {
    evidence.line(problem);
    evidence.finish();
    return 2;
  }
  const marker = findEnabledMarker(
    options.out,
    before.identity.value.Account ?? "",
    options.region,
  );
  const otelRunning = isRunning(before.otel);
  const stopOtel = otelRunning && (marker !== undefined || options.force);
  const otelBlocked = otelRunning && !stopOtel;
  const stopResourceTags =
    options.stopResourceTags && isRunning(before.resourceTags);

  const ownership = marker
    ? `This script's \`enable --apply\` started it at ${marker.startedAt} (\`${ENABLED_MARKER}\` under \`${options.out}\`).`
    : `No \`enable --apply\` for this account and region is recorded under \`${options.out}\`.`;
  const otelPlans = [
    {
      applies: !otelRunning,
      text: "- OTel enrichment is not running; nothing to stop.",
    },
    {
      applies: stopOtel,
      text: `- \`aws cloudwatch stop-o-tel-enrichment\`. ${options.force && !marker ? "Forced with --force." : ownership}`,
    },
    {
      applies: otelBlocked,
      text: `- OTel enrichment is running and will NOT be stopped. ${ownership} Someone else may depend on it; pass --force only if you are sure.`,
    },
  ];
  const resourceTagHint =
    marker?.startedResourceTags && isRunning(before.resourceTags)
      ? " This script's `enable` started it; pass --stop-resource-tags to stop it."
      : "";

  evidence.line("## Plan");
  evidence.line();
  otelPlans
    .filter((plan) => plan.applies)
    .forEach((plan) => {
      evidence.line(plan.text);
    });
  evidence.line(
    stopResourceTags
      ? "- `aws observabilityadmin stop-telemetry-enrichment`."
      : `- Leave resource tags on telemetry as it is.${resourceTagHint}`,
  );
  evidence.line();

  if (!options.apply) {
    evidence.line("Dry run. Re-run with --apply to make these changes.");
    evidence.finish();
    return 0;
  }
  if (otelBlocked) {
    evidence.line(
      "Nothing changed: OTel enrichment is running and this script did not start it. See the plan above.",
    );
    evidence.finish();
    return 1;
  }

  const settings: Setting[] = [
    {
      name: "OTel enrichment",
      stop: stopOtel,
      args: ["cloudwatch", "stop-o-tel-enrichment"],
      after: (status) => status.otel,
    },
    {
      name: "Resource tags on telemetry",
      stop: stopResourceTags,
      args: ["observabilityadmin", "stop-telemetry-enrichment"],
      after: (status) => status.resourceTags,
    },
  ];
  const stopped = settings
    .filter((setting) => setting.stop)
    .map((setting) => ({
      setting,
      result: awsJson<unknown>(options.region, setting.args),
    }));
  evidence.save("stop-results.json", stopped);

  const after = readStatus(options.region);
  evidence.save("status-after.json", after);
  reportStatus(evidence, after, "After");

  const failures = [
    ...stopped
      .filter(({ result }) => !result.ok)
      .map(
        ({ setting, result }) =>
          `- ${setting.args.join(" ")} failed: ${result.ok ? "" : result.error}`,
      ),
    ...stopped
      .filter(({ setting }) => stillOn(setting.after(after)))
      .map(
        ({ setting }) =>
          `- ${setting.name} is not confirmed stopped; check the After table.`,
      ),
  ];
  failures.forEach((failure) => {
    evidence.line(failure);
  });
  evidence.line(
    failures.length
      ? "Disable did not complete."
      : `Disabled at ${new Date().toISOString()}. Data already ingested stays queryable until it ages out.`,
  );
  evidence.finish();
  return failures.length ? 1 : 0;
}
