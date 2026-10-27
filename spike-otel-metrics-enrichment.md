# Spike Record: OpenTelemetry Enrichment of CloudWatch Metrics (PLAT-873)

Status: desk research, code slice and spike script done on 26 October 2026; the deployed session with Platform has not run yet ("How to Test It Deployed" says how to run it). Every claim carries its evidence: `measured` (run here, output kept), `traced` (primary source read directly), `reported` (someone else's report, not checked) or `inferred` (reasoned, not observed). These follow principle 6 of the conversion method in PR 584 (`spike-conversion-method.md`); this spike adds a capability rather than replacing one, so it borrows the record's shape, not the whole method.

## Summary

- **What the feature is.** Two account-level CloudWatch settings, one per region. "Resource tags on telemetry" attaches each resource's AWS tags to its metrics and logs. "OTel enrichment" then republishes AWS's own metrics (Lambda, API Gateway and about 70 other namespaces) as OpenTelemetry series carrying the resource ARN and tags, so they can be queried with PromQL. Nothing changes in our Lambdas, and the original CloudWatch metrics stay as they are. `traced`
- **Deploying this branch with the switch unset changes nothing.** The core stack synthesises byte for byte the same as `main`. With `FLEX_OTEL_METRICS=all` or `scoped` it adds two account-level resources to `<env>-FlexCore`. `measured`
- **The ticket's example metric is the weakest one to demonstrate.** Our API Gateways are REST APIs. AWS enriches their metrics with neither the ARN nor tags, so a PromQL version of the API Gateway latency graph works but can be filtered only by the same dimensions CloudWatch already has. `traced`
- **Lambda is the strong case.** Lambda function metrics get the ARN and every tag. Every FLEX stack already tags its resources with `Stage`, `Environment` and `ResourceOwner` (the domain), so queries such as "p95 Duration per domain on stage X" become one line of PromQL, where today they need one metric line per function. `traced`, query untested
- **Part of the value comes without OTel at all.** Turning on resource tags alone enables tag-based Metrics Insights (SQL) queries and alarms, and adds `@aws.tag.*` fields to Lambda logs for Logs Insights. The PromQL step is the only part with a published charge. `traced`
- **Cost is small for FLEX.** London prices are the same as US East: $0.50 per GB of enriched data and $0.01 per million samples for PromQL through the API; console and dashboard queries are free. An upper bound for one stage, assuming every series reports every minute, is about $3 a month. The real figure depends on how many stages share the account and on how many other teams' resources are in it, because the setting covers the whole account. `measured` (prices), `inferred` (volumes)
- **An existing problem the spike found.** Both REST APIs are created without a name, so every stage's API is called `Api` (and `PrivateGateway`), and every stage's stage is `prod`. The API alarms and the driving and UDP dashboards filter on exactly those values, so in the development account they mix traffic from every stage that shares the account. Enrichment can't fix this for REST APIs. `traced`
- **Recommendation (provisional, pending the deployed session):** turn on resource tags on telemetry in every account, since it is not separately priced and gives tag filtering to Metrics Insights, alarms and logs. Adopt OTel enrichment in `scoped` mode (`AWS/Lambda` and `AWS/ApiGateway` only) if the session shows the PromQL queries below are worth having over Metrics Insights. Name the REST APIs per stage either way.

---

## Frame

| Item | Value |
|---|---|
| Ticket | PLAT-873, Spike: Enable and Evaluate OTEL (OpenTelemetry) Metrics |
| Question | Does OTel enrichment of CloudWatch metrics give enough operational value over default CloudWatch to justify its cost? |
| Decision it feeds | Whether OTel metrics become part of the platform baseline |
| Exit criteria (from the ticket) | One FLEX metric re-graphed with PromQL; cost impact documented; PromQL compared with default CloudWatch; a clear recommendation |
| Timebox | 3 days |
| Working model | Mob: Cloud Platform engineer plus a FLEX or UDP engineer (for example Nathan Berry, Matt Cavanagh) |
| Relation to PLAT-874 | None in code. PLAT-874 adds the OTel layer for traces; enrichment needs no layer and no Lambda change |

---

## What Was Checked at the Source

All `traced` from the AWS documentation on 26 October 2026, unless marked otherwise.

| Fact | Source |
|---|---|
| Enrichment covers vended metrics that have a resource identifier dimension, adds `cloud.resource_id` (ARN), cloud provider, region, account and tags; the classic metric is unchanged | [AWS vended metrics in OpenTelemetry format](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-OTelEnrichment.html) |
| Resource tags on telemetry must be on first; it creates a Resource Explorer index and managed view, and needs `observabilityadmin:StartTelemetryEnrichment`, `iam:CreateServiceLinkedRole`, `resource-explorer-2:CreateIndex`, `resource-explorer-2:CreateManagedView`, `resource-explorer-2:CreateStreamingAccessForService` | [Enable resource tags on telemetry](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/EnableResourceTagsOnTelemetry.html), [AWS::ObservabilityAdmin::TelemetryEnrichment](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-observabilityadmin-telemetryenrichment.html) |
| Resource tags alone enable tag-based Metrics Insights queries and alarms, and `@aws.tag.*` fields in Logs Insights for supported resources (Lambda functions included) | [Using resource tags for telemetry](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/UsingResourceTagsForTelemetry.html) |
| `AWS::CloudWatch::OTelEnrichment` is a singleton per account; creating it starts enrichment, deleting it stops it; `IncludeFilters` and `ExcludeFilters` change without interruption | [AWS::CloudWatch::OTelEnrichment](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-cloudwatch-otelenrichment.html) |
| Filters select by exact namespace and optional metric names, at most 100 selectors in total; starting on an account that is already running is a silent no-op that keeps the stored filters | [Filtering enrichment by namespace and metric](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-OTelEnrichment-Filtering.html) |
| REST API metrics (`ApiName`, `Stage`, plus the `...ByMethod` series with `Method` and `Resource`): ARN "Not supported", tags "Not supported". HTTP and WebSocket APIs (`ApiId`): ARN supported, tags not | [Supported AWS resources and metrics](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-OTelEnrichment-SupportedMetrics.html) |
| Lambda function metrics (`Invocations`, `Errors`, `Duration`, `Throttles`, `ConcurrentExecutions` and others): ARN and tags supported. `Duration` is a histogram. All enriched instruments use delta temporality | Same page |
| PromQL is available in Europe (London) for ingest, query and Query Studio; querying needs `cloudwatch:GetMetricData` and `cloudwatch:ListMetrics`; one query returns at most 500 series and spans at most 7 days | [Query metrics with PromQL](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-PromQL.html) |
| Delta histograms need `sum_over_time`, not `rate`; `rate` returns a wrong answer on them without a warning | [PromQL querying](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-PromQL-Querying.html) |
| A Query Studio result can be added to a CloudWatch dashboard as a widget. The dashboard body format for a PromQL widget is not documented | [Running PromQL queries in Query Studio](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-PromQL-QueryStudio.html) |
| The CLI commands are `aws cloudwatch start-o-tel-enrichment`, `get-o-tel-enrichment`, `update-o-tel-enrichment`, `stop-o-tel-enrichment`. The user guide's own example says `start-otel-enrichment`, which is not the command's name | [CLI reference](https://docs.aws.amazon.com/cli/latest/reference/cloudwatch/start-o-tel-enrichment.html) |
| `aws-cdk-lib` 2.261.0 (ours) has `CfnOTelEnrichment` and `CfnTelemetryEnrichment`, but `CfnOTelEnrichmentProps` has no filter properties yet, so the slice sets `IncludeFilters` with a property override | `node_modules/aws-cdk-lib/aws-cloudwatch/lib/cloudwatch.generated.d.ts`, `measured` (read and synthesised) |

---

## Inventory

What FLEX has that enrichment would touch, from the code on `main` at `dc154dd3`. `traced`

| Touchpoint | Location | Count | Effect of enrichment |
|---|---|---|---|
| Lambda functions | Domain and platform stacks | 40 on one personal stage (measured in PLAT-874 on 23 October 2026) | ARN and tags on every function metric |
| Tags on every FLEX resource | `base/index.ts:181` adds `Environment` and `Stage`; each stack adds `Product`, `System`, `Owner`, `ResourceOwner`, `Source` | 7 tags | Become PromQL labels such as `"@aws.tag.Stage"` |
| `ResourceOwner` on Flex functions | `flex-*-function.ts` constructs, set to the domain name | 3 constructs | Group Lambda metrics by domain |
| REST APIs | `stacks/platform.ts:148` (`Api`) and `:267` (`PrivateGateway`), no `restApiName`, stage `prod` | 2 per stage | Republished in PromQL with the same dimensions; no ARN, no tags |
| API alarms | `constructs/alarms/api-gateway.ts:39` (`ApiName`, `Stage`) | 1 construct | None; unchanged classic metrics |
| Dashboards | `stacks/cloudwatch-dashboards.ts`, `dashboards/drivingDashboard.json` (37 widgets), `udpDashboard.json` (30 widgets), all `AWS/ApiGateway` by `ApiName`, `Resource`, `Method`, `Stage` | 67 widgets | None; candidates for re-graphing |
| Account-level settings already in code | `stacks/core/api-gateway.ts` (`CfnAccount`) in `FlexCoreStack`, persistent environments only | 1 | The new resources sit beside it |
| Other teams' resources in the same accounts | Unknown | Unknown | `all` mode enriches them too, and bills this account |

---

## Slice

| Item | Value |
|---|---|
| Branch | `PLAT-873-otel-metrics-enrichment`, from `origin/main` at `dc154dd3` |
| Switch | `FLEX_OTEL_METRICS`, read at synth time. Unset or empty: off. `all`: enrich every supported namespace. `scoped`: enrich `AWS/Lambda` and `AWS/ApiGateway` only. Anything else throws `FLEX_OTEL_METRICS must be one of all, scoped; received "<value>"` |
| Where | `platform/infra/flex/src/stacks/core/otel-metrics-enrichment.ts`, called from `FlexCoreStack`, which exists only in persistent environments (`dev`, `staging`, `prod`), once per account |
| What it adds when on | `AWS::ObservabilityAdmin::TelemetryEnrichment` (`Scope: ACCOUNT`) and `AWS::CloudWatch::OTelEnrichment` depending on it, with `IncludeFilters` in `scoped` mode |
| Turning it off | Unset the switch and redeploy `<env>-FlexCore`. CloudFormation deletes both resources, which stops enrichment and turns resource tags on telemetry off. Enriched data already ingested stays queryable for its 15-month retention. `inferred` from the resource documentation |
| Default build unchanged | `measured`: see "How It Was Tested" step 1 |
| Gates | `measured`, 26 October 2026, in `platform/infra/flex`: `pnpm run lint` exit 0, `pnpm run tsc` exit 0, `pnpm run test --run` 14 files, 72 tests passed |
| Spike script | `scripts/otelMetricsSpike.ts` (`pnpm otel:spike`), with its parts in `scripts/lib/otelMetrics/`; `readFlag` moved from `scripts/enforceS3SecureTransport.ts` to `scripts/lib/args.ts` so both scripts share it. Evidence goes to `otel-metrics-evidence/`, which is in `.gitignore` |

The switch follows the one in PLAT-874 (`FLEX_OTEL_TRACING`). When both are on `main`, the two `resolve...Mode` functions should share one helper.

---

## How It Was Tested

### 1. Synth: off is identical to `main`, on adds exactly two resources

`measured`, 26 October 2026, macOS, Node and pnpm as pinned in the repo. A temporary Vitest file in `platform/infra/flex/src/stacks/core/` synthesised `FlexCoreStack` as `staging`, the way `stack.test.ts` does, four times: once from a copy of `main`'s `stack.ts`, then from this branch with the switch unset, `all` and `scoped`. It wrote each template to JSON. The temporary files were then removed from the source tree.

| Template | SHA-256 | Resources added against `main` |
|---|---|---|
| `main` | `74e195a3829657dc62d4d0860ab36e4d4a4fd0877e30a96657d5a80accbfe9b7` | |
| unset | `74e195a3829657dc62d4d0860ab36e4d4a4fd0877e30a96657d5a80accbfe9b7` | none; byte for byte the same |
| `all` | `eccf81fc0734f819eab974a47b84c08c4853dc00534a773993a047182c7c35cd` | `TelemetryResourceTags`, `OTelMetricsEnrichment`; nothing removed or changed |
| `scoped` | `b36bdf30f71a8fbf32a9a0c683ca6ccaec57c15f3dee9ea41d520380738eaf31` | the same two, with `IncludeFilters` `AWS/Lambda` and `AWS/ApiGateway` |

An unknown value (`on`) threw the error above.

To repeat it, from the repository root:

```bash
cd platform/infra/flex
mkdir -p "$HOME/otel-metrics-synth"
git show origin/main:platform/infra/flex/src/stacks/core/stack.ts > src/stacks/core/stack-main-copy.ts
cat > src/stacks/core/otel-metrics-synth-check.test.ts <<'EOF'
import fs from "node:fs";
import { Template } from "aws-cdk-lib/assertions";
import { afterEach, expect, it, vi } from "vitest";
import { loadInfra } from "../../__tests__/load-infra";

const OUT = process.env.OUT ?? "";

async function synth(label: string, mode: string, module: string) {
  vi.stubEnv("FLEX_OTEL_METRICS", mode);
  const { SsmApp, ENV_KEYS } = await loadInfra("staging");
  const { FlexCoreStack } = await import(module);
  const app = new SsmApp();
  app.addExternalExports("eu-west-2", [
    ENV_KEYS.DvlaConfigSecretArn,
    ENV_KEYS.MonitoringSlackWorkspaceId,
    ENV_KEYS.MonitoringSlackChannelId,
  ]);
  const json = Template.fromStack(new FlexCoreStack(app, "staging-FlexCore")).toJSON();
  fs.writeFileSync(`${OUT}/core-${label}.json`, JSON.stringify(json, null, 2));
}

afterEach(() => vi.unstubAllEnvs());

it("synthesises main, unset, all and scoped", async () => {
  await synth("main", "", "./stack-main-copy");
  await synth("unset", "", "./stack");
  await synth("all", "all", "./stack");
  await synth("scoped", "scoped", "./stack");
});

it("rejects an unknown mode", async () => {
  await expect(synth("bad", "on", "./stack")).rejects.toThrow(/received "on"/);
});
EOF
NODE_ENV=test OUT="$HOME/otel-metrics-synth" pnpm exec vitest --run src/stacks/core/otel-metrics-synth-check.test.ts
rm src/stacks/core/otel-metrics-synth-check.test.ts src/stacks/core/stack-main-copy.ts
cd "$HOME/otel-metrics-synth"
cmp core-main.json core-unset.json && echo "unset is identical to main"
python3 -c '
import json
m = json.load(open("core-main.json"))["Resources"]
for f in ["core-all.json", "core-scoped.json"]:
    r = json.load(open(f))["Resources"]
    print(f, "added:", json.dumps({k: r[k] for k in r if k not in m}),
          "removed:", [k for k in m if k not in r],
          "changed:", [k for k in m if k in r and m[k] != r[k]])
'
```

Expect "unset is identical to main", and for both `all` and `scoped` exactly the two resources above with nothing removed or changed. The hashes can differ on another machine if the bundled Lambda assets differ; the `cmp` and the resource comparison are what matter.

### 2. Prices

`measured`, 26 October 2026. The CloudWatch pricing page reads its figures from AWS's public price list. The OTel entries in that list (published 7 October 2026) give $0.50 per GB for OTel ingestion, $0.50 per GB for vended metric enrichment and $0.00000001 per sample ($0.01 per million) for PromQL, the same in US East, Europe (London) and Europe (Ireland). To repeat it:

```bash
curl -s https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/cloudwatch/USD/current/cloudwatch.json | gunzip -c 2>/dev/null > cw-price.json || curl -s https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/cloudwatch/USD/current/cloudwatch.json > cw-price.json
python3 -c '
import json
d = json.load(open("cw-price.json"))
keys = {"OTel ingestion per GB": "b4Qv4g_87MNNhUIv-ted0JCWOd37SfNhVV7vpUSqi9E",  # pragma: allowlist secret
        "Vended enrichment per GB": "jwxAn2UvOqBDrhW997JKrwnvuAmRxKWBHncGAb7jaZU",  # pragma: allowlist secret
        "PromQL per sample": "uAg6MJSt_R9b-4C-GZI4MjYMx-ouwIxQlJnycXDPr2I"}  # pragma: allowlist secret
for name, key in keys.items():
    print(name, d["regions"]["EU (London)"][key]["price"])
'
```

The keys are the ones the pricing page's HTML uses for those three prices; if AWS changes the page, they change too.

### 3. The spike script, without AWS

`measured`, 26 and 27 October 2026, on a machine with no AWS account access, so this shows the script works, not what AWS returns.

- `pnpm run lint`, `pnpm run tsc` and `pnpm run test --run` in `scripts` passed (11 files, 149 tests). Eight of the files test the spike script's own modules: argument parsing, the query text, the comparison and cost arithmetic, the curl config and reply handling, the evidence files and the status checks. The commands themselves are not unit tested; they were run as below.
- A PromQL request built by the script was sent with the real `curl` 8.7.1 to a local server that recorded it. It arrived as a `POST` to `/api/v1/query_range`, form-encoded, with an `AWS4-HMAC-SHA256` signature for `eu-west-2/monitoring` that covered the session token header, and with the quotes and braces in the PromQL expression intact. The first attempt failed because a newline in curl's config file wasn't escaped; that was fixed and sent again.
- Every command was run end to end against stand-ins for `aws` and `curl` that return made-up responses in the documented formats: `preflight`, `enable` as a dry run and with `--apply` (including waiting for resource tags to report `Running`, and refusing a second run while enrichment is on), `collect`, `cost`, and `disable` as a dry run and with `--apply`. Missing or invalid `--mode`, `--stage`, `--hours` and `--account`, `--apply` without `--account`, and unknown arguments such as `--profile` are rejected before anything runs. `enable --apply` and `disable --apply` refused an `--account` that didn't match the credentials, and refused when a status couldn't be read. `disable --apply` refused to stop OTel enrichment that no `enable --apply` had recorded starting, stopped it with `--force`, left resource tags on unless `--stop-resource-tags` was given, and exited non-zero when a stop call was denied. No credentials appeared in any evidence file.

### 4. Not tested yet

Nothing has been turned on in an AWS account. Every claim below about query results, data volumes and real cost is `inferred` until the session in "How to Test It Deployed" runs.

---

## Capabilities: Default CloudWatch, Resource Tags, OTel Enrichment

`traced` from the documents above; none of it has been tried on FLEX data yet.

| Capability | Default CloudWatch | Plus resource tags on telemetry | Plus OTel enrichment (PromQL) |
|---|---|---|---|
| Query language | Metric math, Metrics Insights (SQL) | Same, with tags in `WHERE` and `GROUP BY` | PromQL (Prometheus 3), alongside the classic ones |
| Filter Lambda metrics by `Stage` or `ResourceOwner` | Only by listing function names | Yes, in Metrics Insights | Yes, `"@aws.tag.Stage"="dev"` |
| Filter REST API metrics by tag | No | No (only `AWS::ApiGatewayV2::Api`, HTTP APIs, is supported) | No |
| Percentiles | Statistics such as `p95` | Same | `histogram_quantile` over delta histograms, needs `sum_over_time` |
| Regular-expression matching on labels | No | No | Yes (`=~`, `!~`) |
| Tags on log events | No | Yes, `@aws.tag.*` in Logs Insights for Lambda | Same |
| Alarms | Classic and Metrics Insights | Tag-based Metrics Insights alarms | PromQL alarms, charged per sample scanned |
| Dashboards | Yes, in code (`CfnDashboard`) | Yes | Yes from Query Studio; the widget's JSON format isn't documented, so keeping it in code needs it read back with `get-dashboard` |
| Grafana | CloudWatch data source | Same | Prometheus-compatible endpoint, signed with SigV4 |
| Cost | Vended metrics free; queries through the API charged | No separate charge is published `inferred` | $0.50 per GB enriched, $0.01 per million samples through the API; console free |

---

## Cost

### Unit prices (`measured`, see "How It Was Tested" step 2)

| Item | London price |
|---|---|
| Vended metric enrichment | $0.50 per GB, uncompressed OTLP size, 15 months' storage included |
| PromQL through the API, Grafana or alarms | $0.01 per million samples scanned |
| PromQL in the console and on dashboards | Free |
| Resource tags on telemetry | No price published `inferred` |

### Model (`inferred`)

AWS gives 300 to 600 bytes as a typical data point with 10 to 15 attributes, and uses 450 bytes in its own example. A vended metric reports at most once a minute, and Lambda and API Gateway report only in minutes with traffic, so a series that is busy all month is the ceiling:

```
1 series x 60 x 24 x 30 = 43,200 data points a month
43,200 x 450 bytes = 19.4 MB = $0.0097 a month per always-active series
```

Upper bound for one FLEX stage, assuming every series is active every minute:

| Source | Series | GB a month | $ a month |
|---|---|---|---|
| Lambda: 40 functions x 5 commonly reported metrics (`Invocations`, `Errors`, `Duration`, `Throttles`, `ConcurrentExecutions`) | 200 | 3.9 | 1.94 |
| API Gateway: 2 APIs x 5 metrics (`Count`, `4XXError`, `5XXError`, `Latency`, `IntegrationLatency`) at stage level, plus the same 5 per method for about 20 routes | 110 | 2.1 | 1.07 |
| Total, `scoped` mode | 310 | 6.0 | about 3 |

At 1 KB a data point, if our 7 tags plus any CloudFormation system tags make each one larger, double it. In a development account with many short-lived stages, multiply by the number of stages active in a month, and by the share of minutes each one has traffic (well under 100% outside load tests). `all` mode adds every other supported namespace in the account, including resources that belong to other teams.

### How to replace the estimate with measurements

`pnpm otel:spike preflight` counts the series active in the last 3 hours in each supported namespace and works out this ceiling from the real counts. `pnpm otel:spike cost` reads the billed CloudWatch usage by usage type from Cost Explorer; run it before turning enrichment on and again a day or two after, and the usage type that appears only afterwards is the enrichment charge. Both are described in "How to Test It Deployed".

---

## How to Test It Deployed

Written for the mob session; not run against AWS yet. Each result is `inferred` until it is. The script `scripts/otelMetricsSpike.ts` runs every step that can be scripted and writes what it saw into a folder per run, so the record can be filled in from files rather than from memory.

### What the machine needs

- This repository, with `pnpm install` done.
- AWS CLI v2 recent enough to have `aws cloudwatch get-o-tel-enrichment` (the reference was checked at 2.36.43). `aws cloudwatch help | grep o-tel` should print the four commands.
- `curl` 7.75 or later (`curl --version`), for request signing. PromQL has no AWS CLI command, so the script calls the HTTP API with curl. Credentials go to curl on standard input, never on the command line.
- Credentials for the development account, signed in the usual way (`aws sso login`, a profile, or environment variables). The script gets them from `aws configure export-credentials`, so any method the CLI understands works.
- Permissions: `cloudwatch:ListMetrics`, `cloudwatch:GetMetricData`, `cloudwatch:GetMetricStatistics`, `cloudwatch:GetOTelEnrichment`, `observabilityadmin:GetTelemetryEnrichmentStatus`, `resource-explorer-2:ListIndexes` for the read-only steps; `ce:GetCostAndUsage` for `cost`; and for `enable` and `disable` also `cloudwatch:StartOTelEnrichment`, `cloudwatch:StopOTelEnrichment`, `observabilityadmin:StartTelemetryEnrichment`, `observabilityadmin:StopTelemetryEnrichment`, `iam:CreateServiceLinkedRole`, `resource-explorer-2:CreateIndex`, `resource-explorer-2:CreateManagedView`, `resource-explorer-2:CreateStreamingAccessForService`.
- Agreement from Platform before `enable`: the setting covers the whole account.

### How the script works

```bash
pnpm otel:spike --help
pnpm otel:spike <preflight|enable|collect|cost|disable> [options]
```

- Every run writes a folder `otel-metrics-evidence/<timestamp>-<command>/` under the directory you run it from (change it with `--out`). Each folder holds `summary.md`, the tables printed on screen, and the raw JSON of every AWS call behind them. The folder is in `.gitignore` because it contains the account ID and resource ARNs; copy what the team needs into wherever it keeps spike evidence, not into the repository.
- `enable` and `disable` change nothing without `--apply`; without it they print the plan. With `--apply` they also need `--account <id>`, and refuse unless it is the account the credentials belong to. Choose the account with `AWS_PROFILE` or however you normally sign in; unknown arguments, `--profile` included, are rejected rather than ignored.
- `enable` refuses to touch OTel enrichment if it is already running, because someone else then owns it. When it starts enrichment, it writes `enabled-by-spike.json` into its folder, saying which account and region, and whether it also started resource tags.
- `disable` stops OTel enrichment only if an `enabled-by-spike.json` for the same account and region is under the evidence root (`--out`), so it can't turn off a setting someone else started; `--force` overrides that. It leaves resource tags on unless `--stop-resource-tags` is given, and says when this script started them. It exits non-zero if a stop call fails or the setting isn't confirmed stopped afterwards.
- The region is `AWS_REGION`, then `eu-west-2`, unless `--region` is given.
- `collect` makes PromQL API calls, charged at $0.01 per million samples scanned. A 3-hour window on one stage scans a few thousand samples per query.

### Steps

**0. Before anything changes.**

```bash
pnpm otel:spike preflight
pnpm otel:spike cost --days 7
```

`preflight` records the caller and account, the tool versions, whether either setting is already on, any Resource Explorer index that already exists, the series counts per namespace, and the cost ceiling for `scoped` and `all`. If either setting is already on, stop and find out who owns it before going further. `cost` gives the CloudWatch spend before the change, to compare against later.

**1. Make sure there is traffic.** During the session, run the e2e suites against one stage, more than once if the window is quiet, or rely on the development environment's normal traffic:

```bash
STAGE=<stage> pnpm --filter @flex/dvla-domain run test:e2e --run
STAGE=<stage> pnpm --filter @flex/udp-domain run test:e2e --run
```

The suites target `STAGE`, falling back to `$USER` (`libs/testing/src/e2e/setup.global.ts`).

**2. Turn it on.**

```bash
pnpm otel:spike enable --mode scoped
pnpm otel:spike enable --mode scoped --apply --account <account-id>
```

The first prints the plan, including the account the credentials belong to. The second turns resource tags on telemetry on if needed, waits until it reports `Running` (up to 10 minutes), then starts OTel enrichment for `AWS/Lambda` and `AWS/ApiGateway`, and checks that AWS stored the filters that were sent. Write down the time it finished.

The core stack can do the same through code (`FLEX_OTEL_METRICS=scoped` on a deploy of `<env>-FlexCore`), but don't use both in one account: CloudFormation would fail to create a singleton that already exists, and deleting its resource later would stop enrichment for everyone.

**3. Collect, at least 30 minutes after step 2, with traffic in between.**

```bash
pnpm otel:spike collect --stage <stage> --hours 1
```

`<stage>` is the value of the `Stage` tag, which is the stage name after `sanitiseStageName` (`libs/utils/src/infra/index.ts`); check one function's tags in the console if unsure. The default widget is the driving dashboard's `GET /app/dvla/v1/vehicle-enquiry/{reg}`; choose another with `--resource`, `--method`, `--api-name` (`Api` or `PrivateGateway`) and `--api-stage`. `summary.md` has five sections:

1. **Labels**: how many enriched Lambda series the stage has, which tag labels they carry, whether `aws:cloudformation:*` system tags are among them, how many series carry a `Resource` label as well as `FunctionName`, and the median size of a series' labels in bytes, a rough guide to the size of a data point.
2. **Re-graph**: p50, p90 and p99 latency of the widget, from the classic metric (`get-metric-statistics`) and from PromQL, point by point, with the median and largest differences. A classic point at T covers the five minutes after T and a PromQL point at t covers the five minutes before t, so the row marked "PromQL t-5m = classic T" is the like-for-like comparison.
3. **Tags**: p95 Lambda `Duration` per domain (`ResourceOwner`) on the stage, one PromQL query, run over all series and over series without a `Resource` label. AWS lists `Resource` on every enriched Lambda function metric, so it isn't known yet which form carries the function-level data; if one form is empty, that answers it.
4. **Metrics Insights**: total invocations per domain on the stage from a tag-based Metrics Insights query, which needs only resource tags, next to the same total in PromQL over all series and over function-level series only. If the "all series" column is double the others, the qualified series repeat the function series, and queries must filter on `Resource=""`.
5. **Errors per stage** across the whole account, which only tags make possible in one query, in the same two forms.

Run `collect` again later in the session or the next day with `--hours 24` for a longer comparison. `--hours` can be at most 120, because the classic call returns at most 1,440 five-minute points.

**4. By hand in the console**, saving screenshots into the latest `collect` folder:

- Query Studio, PromQL: run the expressions printed in sections 2 and 3, put the classic widget and the PromQL graph for the same hour side by side, and screenshot both.
- Add one of them to a new dashboard, then save how a PromQL widget is stored, so it can be kept in code next to the existing dashboards:

  ```bash
  aws cloudwatch get-dashboard --dashboard-name <name> --query DashboardBody --output text > otel-metrics-evidence/<latest-collect-folder>/promql-dashboard.json
  ```

- Logs Insights, on one of the stage's Lambda log groups: `filter @aws.tag.Stage = '<stage>' | stats count() by @aws.tag.ResourceOwner`. This comes from resource tags alone.
- Note how long the console took to answer, and anything awkward, such as quoting label names with dots or histogram functions that returned nothing.

**5. A day or two later, the real cost.**

```bash
pnpm otel:spike cost --days 3
```

Compare it with step 0. The usage type that appears only after `enable` is the enrichment charge, and its usage quantity in GB gives the real bytes per day for this account.

**6. Turn it off**, unless the decision is to keep it:

```bash
pnpm otel:spike disable
pnpm otel:spike disable --apply --account <account-id>
```

Run it from the same directory as `enable`, or pass the same `--out`, so it finds `enabled-by-spike.json`. This stops OTel enrichment and leaves resource tags on, which keeps tag filtering in Metrics Insights and Logs Insights. If step 0 showed resource tags off before the spike, add `--stop-resource-tags` as well; the plan says when this script started them. If enrichment was on before the spike, don't disable it at all; the script refuses unless `--force` is given.

### Writing it up

Copy each run's folder to the team's evidence location, then fill in "Deployed Results" below from the `summary.md` files, change the tag of each claim you checked from `inferred` to `measured` with the folder name as its source, and update the Summary, the Cost table, the Open Questions and the Decision. Anything that didn't behave as this section says goes in "Deployed Results" too, with what happened instead.

What it doesn't cover: staging and production accounts, metrics from Central Observability's accounts, cross-account monitoring, PromQL alarms, and OTLP metrics sent by our own code (which would need the PLAT-874 layer or an SDK change and is a separate question).

---

## Deployed Results

Not run yet. To be filled in from the evidence folders.

| Item | Result | Evidence folder |
|---|---|---|
| Date, account, stage, who ran it | | |
| Either setting already on before the spike? | | `preflight` |
| Series counts, `scoped` and `all`, and the cost ceiling | | `preflight` |
| Time from `enable` to the first enriched data | | `enable`, `collect` |
| Tag labels present; CloudFormation system tags present? | | `collect` section 1 |
| Median label bytes per series | | `collect` section 1 |
| Which series carry function-level data, and do qualified series double-count (`Resource` label)? | | `collect` sections 1, 3, 4 and 5 |
| Re-graph: median and largest p50, p90, p99 difference | | `collect` section 2 |
| p95 Duration per domain, one query | | `collect` section 3 |
| Metrics Insights with tags answers the same question? | | `collect` section 4 |
| How a PromQL dashboard widget is stored | | `promql-dashboard.json` |
| Logs Insights by tag works? | | screenshot |
| Real enrichment GB per day and USD per day | | `cost` |
| Turned off, and when | | `disable` |
| Anything that didn't match "How to Test It Deployed" | | |

---

## Difficulty

| Dimension | Score | Why |
|---|---|---|
| Breadth | 1 | Two account-level resources; no change to any function |
| Depth | 1 | Configuration only |
| Unknowns | 3 | Real volume, data point size with our tags, and query usefulness can only be answered in a deployed account |
| Verifiability | 3 | Needs an account with traffic |
| Reversibility | 1 | Switch off and redeploy, or two CLI calls; ingested data simply ages out |
| Coupling | 3 | The setting is per account, so Platform and any other team in the account are affected and must agree |
| Constraints | 2 | Permissions: `iam:CreateServiceLinkedRole` and Resource Explorer actions, which FLEX deploy roles may not have |

Overall 3, driven by unknowns, verifiability and coupling. None of them is technical risk; they are why the session must run with Platform.

---

## Effort

`reported`, AI-assisted (one session, 26 October 2026, start and end times not logged): desk research, the slice, the synth check and this record took roughly 1 to 2 hours. That shows the size of the work, not how long it takes a team member. The deployed session is estimated at half a day for two people.

---

## Open Questions

| Question | How to answer | Who |
|---|---|---|
| Is either setting already on in any FLEX account, perhaps turned on by Platform or another team? | Step 0 | Platform |
| Should it be managed in FLEX's core stack or in Platform's account baseline? The singleton belongs to the account, not to FLEX | Agree before step 2; if Platform owns it, drop the switch from this branch | Platform, FLEX |
| Do our CloudFormation deploy roles have `observabilityadmin:*`, `iam:CreateServiceLinkedRole` and the `resource-explorer-2` actions? | Try step 2 through code in development | Platform |
| Does the account already have a Resource Explorer index, and does turning resource tags on conflict with it? | Step 0 (`preflight` lists the indexes) | Platform |
| Are `aws:cloudformation:*` system tags included as labels, and how big is a FLEX data point really? | Step 3 section 1, then `cost` in step 5 | Session |
| Do PromQL and classic graphs of the same metric agree? | Step 3 section 2 | Session |
| Do Metrics Insights with tags answer the same questions without the PromQL charge? | Step 3 section 4 | Session |
| Should the REST APIs get a name per stage (`restApiName`), so that alarms, dashboards and any PromQL query stop mixing stages? | Separate ticket; it affects `constructs/alarms/api-gateway.ts` and both dashboards | FLEX |
| Is turning resource tags on separately charged? | `cost` in step 5 | Session |

---

## Decision

Not made yet. To be recorded here after the session: the recommendation, the decision, the date, who decided, and the evidence it rests on.
