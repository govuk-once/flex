# Conversion Record: X-Ray to OpenTelemetry (PLAT-874)

Follows `spike-conversion-method.md`. Reviewed by two AI reviewers (Codex and Grok) on 21 and 22 October 2026. Their findings were checked against the code and the layer, and are folded in.

## Summary

- **Deploying this change on its own changes nothing.** With `FLEX_OTEL_TRACING` unset, which is how every pipeline and developer deploys today, no layer, variable or tracing setting is added. Everything below about cost and risk applies only once the switch is set, which is the measurement the spike is for.
- **What the conversion actually is.** FLEX has no application-level X-Ray SDK, so there's nothing to rip out. The conversion adds the AWS Lambda Layer for OpenTelemetry to the three Flex Lambda constructs. In-process instrumentation becomes OpenTelemetry, and spans are still delivered to X-Ray through the Lambda X-Ray daemon, so `Tracing.ACTIVE` stays on (and is forced on while the switch is on). Moving the trace backend off X-Ray would be a separate conversion.
- **Cost, one-off:**
  - The slice is 2 files and 94 lines added (a CDK Aspect and its registration in `app.ts`; the Lambda constructs are unchanged), behind the switch `FLEX_OTEL_TRACING` (`full` or `lite`; unset or empty is off).
  - The three constructs are used at 9 call sites, so the slice reaches every domain route, service gateway and the API authorizer. It also reaches the DVLA secret rotation, credential monitor and smoke test functions in persistent environments.
  - Three kinds of rollout work remain:
    - setting the switch in CI;
    - verifying each environment, because a personal stage doesn't build every affected stack;
    - a data classification review of span attributes.
  - Manual spans for function-level depth (the ticket's "about 15 levels") are not included.
- **Cost, recurring:**
  - Start-up overhead measured locally: +86 ms in `lite` mode and +104 ms in `full` mode, on a 79 ms baseline. This is not Lambda `Init Duration`; the deployed figure is still to be measured, and it will differ between functions with and without provisioned concurrency.
  - The layer adds 7.17 MB uncompressed, 2.7% of the 250 MB limit.
  - The layer version is pinned, so it needs bumping when AWS releases a new one.
  - Span volume grows with outbound calls, including each `flexFetch` retry. X-Ray cost: not yet calculated.
- **Difficulty: 3 overall**, from five dimensions:
  - **Breadth:** the change is three constructs, but it reaches every Flex function.
  - **Unknowns and Verifiability:** isolated delivery, real `Init Duration`, the runtime's own loading path and cost can only be answered on a deployed stage.
  - **Coupling:** Cloud Platform owns the spike, and security will want a say on span attributes.
  - **Constraints:** the isolated network, data classification, and CI configuration.
  - Depth and Reversibility are low: it's configuration only, and switching it off removes it.
- **Main risk retired locally.** On Node.js 24, the layer instruments FLEX's esbuild CommonJS bundle, including its getter-only `handler` export. It produced spans for the Lambda invocation, the AWS SDK and, once `undici` is enabled, for `fetch`. The span kept the trace context it was given.
- **Data classification findings:**
  - `fetch` spans record `url.full`, `url.path` and `url.query` as sent. FLEX gateways put user and notification IDs in paths and queries; for example, the UNS gateway puts `externalUserID` in the query (`platform/domains/uns/src/gateway.ts:41`, `:48`).
  - AWS SDK spans record `aws.auth.account.access_key` (the access key ID).
  - The layer's redaction (`AWS_REDACT_SPAN_ATTRIBUTES`) is registered only in `full` mode. **`lite` mode cannot redact.**
  - Outbound calls gain trace headers. The layer defaults `OTEL_PROPAGATORS` to `baggage,tracecontext,xray`, so every `fetch`, including calls to third parties, would carry `traceparent` and `X-Amzn-Trace-Id`, and `baggage` whenever the context holds any. FLEX sends none of these today. The slice leaves the default; whether to restrict it (for example to `xray` only) is for security to decide.
- **Recommendation:**
  1. On a personal stage, take the baseline with the switch unset.
  2. Deploy `full` and take the same measurements, with redaction configured.
  3. Measure `lite` only for comparison, since it can't redact.
  4. Agree the span attributes and the outbound trace headers with security before any persistent environment.
  5. Decide on adoption once the deployed numbers are in.

---

## Frame

| Item | Value |
|---|---|
| Ticket | PLAT-874 (with PLAT-873 and PLAT-875, under PLAT-813) |
| Question | How long would it take to swap application tracing from native X-Ray to ADOT in an active codebase, and what do we get: trace quality and depth, manual span effort, pain points, cold start impact |
| Decision it feeds | Whether FLEX adopts the OpenTelemetry layer, and in which mode |
| Exit criteria | Slice verified on a deployed stage, baseline and after figures for cold start and latency, trace depth compared, span attributes classified, recommendation recorded |
| Timebox | 3 days (mob session with a product engineer, per PLAT-813) |
| Owner | FLEX |

---

## Inventory

| Touchpoint | Location | Count | In slice | Change |
|---|---|---|---|---|
| Lambda active tracing (`Tracing.ACTIVE`) | `platform/infra/flex/src/constructs/lambda/flex-public-function.ts`, `flex-private-egress-function.ts`, `flex-private-isolated-function.ts` | 3 constructs | Yes | None in the constructs. While the switch is on, the `EnableOtelTracing` Aspect adds the layer and environment to their functions and forces active tracing on |
| Call sites of those constructs | `stacks/domain.ts:246`, `:248`, `:255`; `utils/create-service-gateway.ts:105`, `:110`; `stacks/platform.ts:112` (authorizer); `stacks/core/dvla-secret-rotation.ts:44`; `stacks/credential-monitor.ts:78`; `stacks/smoke-test.ts:102` | 9 | Yes, through the constructs | None at the call sites. The last three stacks exist only in persistent environments (`app.ts:64`, `:98`) | <!-- pragma: allowlist secret -->
| API Gateway tracing (`tracingEnabled: true`) | `platform/infra/flex/src/stacks/platform.ts:151`, `:306` | 2 | No | None. Whether OpenTelemetry spans join API Gateway segments in a deployed trace is to be verified |
| X-Ray SDK call sites | Whole repo | 0 | n/a | None to remove |
| Permissions boundary `AllowXRayTracing` | `platform/infra/flex/src/utils/createPermissionsBoundary.ts:40` | 1 | No | None. UDP export to the daemon uses the existing `xray:PutTraceSegments` |
| DVLA rotation boundary `AllowXRayTracing` | `platform/infra/flex/src/stacks/core/dvla-secret-rotation.ts:96` | 1 | No | Keep. The function itself is a `FlexPrivateEgressFunction` (`:44`) and takes the layer |
| Managed policy and `CfnDiscovery` for Application Signals | Not present | 0 | No | Not needed while Application Signals is off |
| Lambda functions not built from the Flex constructs | `constructs/infra/CfnPause.ts:22` and the CDK provider function it creates, `stacks/platform.ts:56` (JWKS stub), `constructs/alarms/alarm-relay.ts:65` | 4 | No | Out of scope. `constructs/cloudfront/flex-cloudfront-function.ts:59` is a CloudFront Function, not a Lambda |
| Outbound HTTP (`flexFetch`, `typedFetch`, global `fetch`) | `libs/sdk/src/fetch/` | 1 mechanism | Yes | Traced by the layer's `undici` instrumentation; each retry (up to 6 attempts, `fetch.ts:69`) is its own span |
| AWS SDK v3 client constructions | `domains/udp/src/services/linkingId.ts:18`; `libs/service-gateway/src/client/adapter/dynamo.ts:45`, `:50`; `libs/service-gateway/src/client/adapter/dynamodb/client.ts:40`, `:45`; `libs/utils/src/infra/index.ts:50`; `platform/domains/credential-monitor/src/aws/` (4); `platform/domains/dvla-secret-rotation/src/secrets-manager-client.ts:9`; `platform/infra/flex/src/constructs/alarms/relay-handler.ts:3`; `platform/smoke-test/src/handler.ts:8` | 13, of which 11 run in Flex functions | Yes, where the function is a Flex construct. `libs/utils/src/infra/index.ts:50` runs only in e2e test setup, and `relay-handler.ts:3` is the inline alarm relay, which is not a Flex construct | Traced by the layer's `aws-sdk` instrumentation, on by default. Secrets Manager and SSM reads through Powertools use SDK v3 clients, so they should be traced too (`inferred`) | <!-- pragma: allowlist secret -->
| Runtime configuration | `platform/infra/flex/src/aspects/otel-tracing.ts`, registered in `src/app.ts` | 1 layer, 4 variables | Yes | `AWS_LAMBDA_EXEC_WRAPPER`, `OTEL_AWS_APPLICATION_SIGNALS_ENABLED`, `OTEL_NODE_ENABLED_INSTRUMENTATIONS`, `OTEL_AWS_LAMBDA_FAST_START` |
| Trace ID in logs (`xray_trace_id`) | `libs/logging/src/formatter.ts:44` | 1 | No | None. `_X_AMZN_TRACE_ID` is still set under active tracing |
| VPC endpoints | `platform/infra/flex/src/stacks/core/endpoints.ts` | 6, none for X-Ray | No | None yet; delivery from isolated functions is an open question |
| Bundling | `NodejsFunction` defaults (CommonJS, x86_64) | 3 constructs | No | None |
| CI/CD | `.github/workflows/_build-deploy.yml:25` sets `STAGE` only; the switch appears in no workflow | 0 references | No | A pipeline deploy synthesises with the switch off and would remove a manually enabled layer. Rollout needs the switch set per environment in CI |
| Tests | `platform/infra/flex` | 0 tests assert tracing | No | None added yet. A synth check covers the switch for the public construct (see Slice); tests in the suite are to replace it |
| Docs and runbooks using X-Ray | `docs/domain-developer-capabilities.md:28`, `docs/runbooks/api-gateway-5xx.md:60`, `docs/runbooks/lambda-errors-throttling-alarm.md:292-309`, `docs/runbooks/verify-environment-health.md:222`, `platform/infra/flex/README.md:89` | 5 | No | None needed while the backend stays X-Ray; review once adopted |
| Data classification | `docs/data-classification-and-encryption.md` | 1 | No | Span attributes need classifying (see Evidence) |
| Other teams and approvals | Cloud Platform (owns PLAT-813 spikes), security (span attributes) | 2 | No | Agreement needed before persistent environments |

---

## Baseline

The current traces and timings in AWS have not been measured yet; all of that needs a deployed stage. Capture these with the switch **unset first**, then repeat with `full` and `lite` on the same stage and routes:

| Measure | Value | Unit | Source | Evidence |
|---|---|---|---|---|
| Lambda `Init Duration`, p50 and p95, over at least 20 cold starts, for a domain route and the authorizer | to measure | ms | REPORT lines in the function's log group | |
| Lambda `Duration` p95 | to measure | ms | CloudWatch `AWS/Lambda` | |
| API Gateway `Latency` p95 | to measure | ms | CloudWatch `AWS/ApiGateway` | |
| Trace depth for one gateway call | to measure | segments and subsegments, levels | X-Ray trace view | |
| X-Ray traces recorded and retrieved per month, per environment | to measure | count | X-Ray console, Cost Explorer | |
| Function package size | to measure | MB | Lambda console | |
| Local start-up with no wrapper (example `GET /v0/headers` handler) | 79 | ms, median of 7 | Local run (see Evidence) | `measured` |

A personal stage doesn't build the Core, smoke-test or credential-monitor stacks, has no provisioned concurrency on gateways (staging and production have 2, `utils/create-service-gateway.ts:69`, `:127`), and uses the default memory where higher environments use 1024 MB (`stacks/domain.ts:249`, `:256`). Its figures describe that development configuration only; they set no bound in either direction for staging or production, which need their own measurement.

---

## Parity Contract

| Must stay identical | May change | New |
|---|---|---|
| API Gateway to Lambda traces in X-Ray, and the service map the runbooks use | Cold start time (within an agreed budget) | Spans for AWS SDK calls |
| Trace ID in log lines (`xray_trace_id`) and correlation IDs | Number of segments per trace | Spans for outbound `fetch` calls, one per attempt |
| Default build when the switch is off | Package size (layer adds 7.17 MB) | `faas.coldstart` attribute on the Lambda span |
| Handler behaviour and responses | | Span attributes containing URLs, paths, query strings and the access key ID |
| | | Trace headers (`traceparent`, `baggage`, `X-Amzn-Trace-Id`) on outbound `fetch` calls |
| IAM and permissions boundary | | |

---

## Slice

| Item | Value |
|---|---|
| Branch | `PLAT-874-xray-to-otel-conversion`, from `origin/main` at `604331fe` |
| Commit | not committed yet |
| Switch | `FLEX_OTEL_TRACING` at synth time. Unset or empty: off. `full`: full SDK, with `OTEL_AWS_LAMBDA_FAST_START=false` set explicitly so a domain variable can't switch it to lite. `lite`: `OTEL_AWS_LAMBDA_FAST_START=true`. Any other non-empty value fails the synth |
| Diff stat | 2 files, 94 lines added: `platform/infra/flex/src/aspects/otel-tracing.ts` (new, 92 lines), an Aspect that visits `FlexPublicFunction`, `FlexPrivateEgressFunction` and `FlexPrivateIsolatedFunction`, and 2 lines in `src/app.ts` to register it. The constructs are unchanged, which keeps SonarCloud's duplicated-code gate passing |
| Layer | `arn:aws:lambda:eu-west-2:615299751070:layer:AWSOpenTelemetryDistroJs:16` (release v0.13.0, 22 September 2026), built from the stack's region |
| Environment set | `AWS_LAMBDA_EXEC_WRAPPER=/opt/otel-instrument`, `OTEL_AWS_APPLICATION_SIGNALS_ENABLED=false`, `OTEL_NODE_ENABLED_INSTRUMENTATIONS=aws-sdk,undici`, `OTEL_AWS_LAMBDA_FAST_START` (`false` or `true`). These override a domain's own values for the same keys; other `OTEL_*` variables a domain sets still apply |
| Tracing | While the switch is on, a function whose caller disabled tracing gets `TracingConfig: Active` and the same `xray:PutTraceSegments` and `xray:PutTelemetryRecords` statement CDK adds for active tracing, so a caller can't disable the daemon the layer exports to. With the switch off, a caller's own `tracing` is kept as before |
| Default build unchanged | `measured` for the public construct and the properties checked; `traced` for the other two. A synth of two `FlexPublicFunction`s (one with domain variables, one passing `tracing: DISABLED`) for each switch value: unset and empty print no `Layers`, only the domain variables and `FLEX_ENVIRONMENT`, and the caller's `TracingConfig`; `full` and `lite` add the layer and variables and set `TracingConfig: Active` on both, and both roles have the X-Ray statement; `bogus` fails with the expected error. The egress and isolated constructs go through the same Aspect branch, read but not synthesised. No full template comparison or deployed rollback has been done (see "How It Was Tested", step 8) |
| Gates | `@platform/flex` lint and `tsc` exit 0, tests 14 files and 72 passing |

To try it on a personal stage, follow "How to Test It Deployed" below: deploy with the switch unset (`pnpm run deploy`) and take the baseline, then `FLEX_OTEL_TRACING=full pnpm run deploy` and measure again, then the same with `lite`.

---

## Evidence

Local runs used the published v0.13.0 layer, unpacked on a MacBook, with a small local harness standing in for the Lambda runtime (see the next section). The raw output is not in the repository, so under Principle 11 of the method a reader should treat the `measured` rows below as `reported` until they repeat them. "How It Was Tested" below gives every command and the output to expect. Files named below as "the layer's" are part of the public release, not of this repository.

| Claim | Evidence | Source |
|---|---|---|
| The current layer is `AWSOpenTelemetryDistroJs:16` in eu-west-2 and us-east-1 | `traced` | Release notes of `aws-observability/aws-otel-js-instrumentation` v0.13.0. Two web search answers gave `AWSOpenTelemetryDistroNodeJS:29` and `AWSOpenTelemetryDistroJs:11`, both wrong |
| The layer is 7,165,581 bytes uncompressed (1,738 files), 2.7% of 250 MB | `measured` | Listing of the release's `layer.zip` |
| The layer's ZIP has SHA-256 `2c7443ed8dfebefbfffc973fdf30209568437fab05d36ce6e3b1970a7a80606f` | `measured`, `reported` | Hashed locally. The match with the release's published checksum was seen on first download, but that comparison was not kept |
| On Node.js 24 the wrapper takes the ESM path (`--import /opt/wrapper.mjs`, import-in-the-middle), even for CommonJS bundles | `traced` | The layer's `otel-instrument` script |
| The esbuild CommonJS bundle exports `handler` as a getter-only, non-configurable property | `measured` | Bundle of `domains/example/src/handlers/v0/headers/get.ts` built with the CDK default settings |
| The layer instruments that bundle anyway: one `aws-lambda` span per invocation | `measured` | Span captured by the local UDP listener; the harness calls the module namespace's `handler`, as an ESM-loading runtime would |
| The span keeps the trace ID and parent given in `_X_AMZN_TRACE_ID` | `measured` | The span datagram contains, as bytes, the made-up `Root` and `Parent` the harness set (`check-context.mjs`, step 6). This shows context is inherited, not that the span joins a real API Gateway segment |
| In Lambda the layer exports spans over UDP to `AWS_XRAY_DAEMON_ADDRESS`, so active tracing must stay on | `traced`, `measured` | The layer's exporter selection in `wrapper.js`; span payloads captured on the daemon address |
| Default instrumentations are `aws-sdk,aws-lambda,http`; `fetch` is not traced by default | `traced`, `measured` | The layer's `otel-instrument` script; a probe handler calling `fetch` and DynamoDB produced Lambda and DynamoDB spans and no `fetch` span |
| With `OTEL_NODE_ENABLED_INSTRUMENTATIONS=aws-sdk,undici`, `fetch` calls produce spans | `measured` | The same probe produced an `undici` `GET` span with method, URL and status |
| `lite` mode produces the same three spans | `measured` | The same probe with `OTEL_AWS_LAMBDA_FAST_START=true` |
| `fetch` spans record `url.full`, `url.path` and `url.query` as sent | `measured` | Decoded probe span: `url.full` = `http://127.0.0.1:4599/upstream?x=1` |
| AWS SDK spans record `aws.auth.account.access_key` | `measured` | Decoded probe span (a dummy value locally; in Lambda it would be the session's access key ID) |
| Span attribute redaction (`AWS_REDACT_SPAN_ATTRIBUTES`) is registered only in `full` mode | `traced` | The layer's `wrapper.js` registers `AttributeRedactingSpanProcessor`; `configureLiteMode` in `lite-wrapper.js` registers only its batching UDP processor. Redaction itself was not tested |
| `lite` mode exports the whole invocation batch without awaiting the UDP send; `full` limits Lambda batches to 10 and awaits the send | `reported` | AI review of the layer's `lite-wrapper.js`, `wrapper.js` and the v0.13.0 source. Only the batch size of 10 in Lambda was checked here. The harness waited 3 seconds after the response, so it can't show whether spans are sent before Lambda freezes |
| Local start-up medians of 7 runs: no wrapper 79 ms, `full` 183 ms, `lite` 165 ms, Application Signals on 183 ms; handler import 68 to 71 ms in all four | `measured` | Process start to first response on a MacBook; indicative only, not Lambda `Init Duration` |
| Outbound `fetch` calls carry `traceparent` and `X-Amzn-Trace-Id`, and `baggage` when the context holds any, while the switch is on | `traced` | The layer's `otel-instrument` script defaults `OTEL_PROPAGATORS` to `baggage,tracecontext,xray`; its `undici` instrumentation injects them into request headers, and its baggage propagator writes nothing when there is no baggage. No FLEX code sets these headers. Not seen on the wire, because the local upstream stub did not log headers |
| No IAM change is needed with Application Signals off | `inferred` | UDP export goes to the daemon, which already has `xray:PutTraceSegments`; to confirm on deploy |

### How It Was Tested

Everything below can be repeated with Node.js 24, the repo installed (`pnpm install`), `curl`, `unzip` and no AWS access, on macOS or Linux, in bash or zsh. The commands are the ones that produced the Evidence rows, with these changes:

- Paths are written as `$REPO` (the repo root) and `$L` (a working folder outside the repo).
- `NODE_ENV=test` is set in the environment file. The original runs did not set it, and emptied the host's `/tmp` (see the last item under "How the harness differs from Lambda"). Never run these without it.
- One `run` function starts all three listeners for every run, where the original runs started only the ones each needed.
- `decode.mjs` also prints `aws.auth` attributes and the probe's URL, and `check-context.mjs` compares the trace ID and parent as bytes.
- The synth check's entry file sits inside `platform/infra/flex`, because CDK rejects an entry outside the repo.

On 22 October 2026 steps 1 to 8 were run again from this text, with `$L` in the home folder, outside the repo. The outcome is recorded after step 8.

**1. Get and check the layer.** Start in the repo root, and run every step in the same shell.

```bash
export REPO="$PWD" L="$HOME/otel-spike"
mkdir -p "$L" && cd "$L"
curl -sLO https://github.com/aws-observability/aws-otel-js-instrumentation/releases/download/v0.13.0/layer.zip
SUM="2c7443ed8dfebefbfffc973fdf30209568437fab05d36ce6e3b1970a7a80606f  layer.zip"
if command -v shasum > /dev/null; then echo "$SUM" | shasum -a 256 -c; else echo "$SUM" | sha256sum -c; fi
unzip -l layer.zip | tail -1
unzip -Z1 layer.zip | awk '/\/$/{d++;next}{f++}END{print "files",f,"dirs",d}'
```

The checksum line must print `layer.zip: OK`. The first `unzip` line gives the uncompressed size (7,165,581 bytes) but counts directories as files (2,120); the second separates them (1,738 files, 382 directories).

**2. Make the layer run from `$L/opt` rather than `/opt`.** The layer hard-codes `/opt` in three files, and the symlink lets the ESM wrapper find the layer's modules. The `package.json` makes `.js` files under `$L` CommonJS even when a parent folder has a `package.json` with `"type": "module"`, as the repo root does.

```bash
mkdir -p opt && unzip -qo layer.zip -d opt
ln -sfn nodejs/node_modules opt/node_modules
sed "s#/opt/#$L/opt/#g" opt/otel-instrument > otel-instrument-local && chmod +x otel-instrument-local
sed -i.bak "s#'/opt/#'$L/opt/#g; s#\"/opt/#\"$L/opt/#g" opt/wrapper.mjs opt/lite-wrapper.mjs
echo '{"type":"commonjs"}' > package.json
```

**3. Build three bundles** with the same esbuild settings the CDK `NodejsFunction` defaults use (CommonJS, Node 24, `@aws-sdk/*` external).

- `task/`: the real example route, `GET /v0/headers`. Its `handler` export comes out getter-only and non-configurable, which is the property the layer has to patch.
- `task-writable/`: the same bundle re-exported through a plain `module.exports`. This was a control in case the getter blocked instrumentation; it turned out not to.
- `task-probe/`: a probe that makes one `fetch` and one DynamoDB call, to see which outbound calls get spans.

```bash
mkdir -p task task-writable task-probe probe-src
(cd "$REPO/domains/example" && ../../node_modules/.bin/esbuild src/handlers/v0/headers/get.ts --bundle --platform=node --target=node24 --format=cjs "--external:@aws-sdk/*" --outfile="$L/task/index.js" --log-level=warning)

cp task/index.js task-writable/bundle.js
cat > task-writable/index.js <<'EOF'
const bundle = require("./bundle.js");
module.exports.handler = bundle.handler;
EOF

cat > probe-src/handler.ts <<'EOF'
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({ region: "eu-west-2", endpoint: "http://127.0.0.1:4599" });

export const handler = async () => {
  const res = await fetch("http://127.0.0.1:4599/upstream?x=1");
  await res.text();
  try {
    await dynamo.send(new GetItemCommand({ TableName: "probe", Key: { id: { S: "1" } } }));
  } catch {}
  return { statusCode: 200, body: "ok" };
};
EOF
"$REPO/node_modules/.bin/esbuild" probe-src/handler.ts --bundle --platform=node --target=node24 --format=cjs "--external:@aws-sdk/*" --outfile="$L/task-probe/index.js" --log-level=warning
```

**4. A Lambda-like environment.** The trace header is made up and sampled, and the X-Ray daemon address points at a local listener. The credentials are dummies. `NODE_PATH` gives the layer its modules and the bundle the repo's AWS SDK, which Lambda would provide from the runtime. The paths are quoted so a checkout path with spaces still works.

```bash
cat > lambda-env.sh <<EOF
export NODE_ENV=test
export NODE_PATH="$L/opt/nodejs/node_modules:$REPO/node_modules/.pnpm/node_modules"
export AWS_REGION=eu-west-2 AWS_EXECUTION_ENV=AWS_Lambda_nodejs24.x AWS_LAMBDA_FUNCTION_NAME=example-headers AWS_LAMBDA_FUNCTION_VERSION='\$LATEST'
export AWS_LAMBDA_LOG_GROUP_NAME=/aws/lambda/example-headers AWS_LAMBDA_LOG_STREAM_NAME=s LAMBDA_TASK_ROOT="$L/task" _HANDLER=index.handler
export _X_AMZN_TRACE_ID='Root=1-6716a000-0123456789abcdef01234567;Parent=53995c3f42cd8ad8;Sampled=1' AWS_XRAY_DAEMON_ADDRESS=127.0.0.1:2000
export FLEX_ENVIRONMENT=development AWS_ACCESS_KEY_ID=x AWS_SECRET_ACCESS_KEY=x
EOF
```

**5. Stand-ins for Lambda and its neighbours.**

- `udp-listen.mjs` plays the X-Ray daemon: it writes every UDP datagram on port 2000 to a file.
- `http-listen.mjs` listens on the OTLP HTTP port 4318. It confirms nothing is exported over HTTP.
- `stub-upstream.mjs` answers the probe's `fetch` and DynamoDB calls with `200 {}` on port 4599.
- `invoke.mjs` plays the runtime. It imports the bundle, reports the shape of the `handler` export, calls the namespace's `handler` with an API Gateway event, then waits 3 seconds so the spans can leave.
- `decode.mjs` pulls readable strings (span names, instrumentation scopes, attribute names, the probe's URL) out of the base64 protobuf in each datagram. Trace and span IDs are binary, so it can't show them.
- `check-context.mjs` looks for the trace ID and parent from `_X_AMZN_TRACE_ID` as raw bytes in each span datagram.
- `time-init.mjs` times one cold process: the handler import, then one call.

Ports 2000, 4318 and 4599 must be free.

```bash
cat > udp-listen.mjs <<'EOF'
import dgram from "node:dgram";
import { writeFileSync, appendFileSync } from "node:fs";
const out = process.argv[2];
writeFileSync(out, "");
const s = dgram.createSocket("udp4");
s.on("message", (m) => appendFileSync(out, m.toString("utf8") + "\n---\n"));
s.bind(2000, "127.0.0.1");
setTimeout(() => s.close(), Number(process.argv[3] ?? 15000));
EOF

cat > http-listen.mjs <<'EOF'
import http from "node:http";
import { writeFileSync, appendFileSync } from "node:fs";
const out = process.argv[2];
writeFileSync(out, "");
const srv = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    appendFileSync(out, `${req.method} ${req.url} ${req.headers["content-type"]} bytes=${body.length}\n${body.toString("latin1").replace(/[^\x20-\x7e]+/g, " ")}\n---\n`);
    res.writeHead(200, { "content-type": "application/x-protobuf" });
    res.end();
  });
});
srv.listen(4318, "127.0.0.1");
setTimeout(() => srv.close(), Number(process.argv[3] ?? 15000));
EOF

cat > stub-upstream.mjs <<'EOF'
import http from "node:http";
const srv = http.createServer((req, res) => { req.resume(); req.on("end", () => { res.writeHead(200, { "content-type": "application/x-amz-json-1.0" }); res.end("{}"); }); });
srv.listen(4599, "127.0.0.1");
setTimeout(() => srv.close(), Number(process.argv[2] ?? 14000));
EOF

cat > invoke.mjs <<'EOF'
const mod = await import(process.env.LAMBDA_TASK_ROOT + "/index.js");
const desc = Object.getOwnPropertyDescriptor(mod.default ?? mod, "handler");
console.log("handler descriptor:", JSON.stringify({ getter: !!desc?.get, writable: desc?.writable, configurable: desc?.configurable }));
const event = {
  resource: "/v0/headers", path: "/v0/headers", httpMethod: "GET",
  headers: { "x-correlation-id": "corr-1", "x-request-id": "req-1" },
  multiValueHeaders: {}, queryStringParameters: null, pathParameters: null,
  requestContext: { requestId: "r1", authorizer: { pairwiseId: "u1" }, path: "/v0/headers", httpMethod: "GET", resourcePath: "/v0/headers", stage: "x" },
  body: null, isBase64Encoded: false,
};
const context = { functionName: process.env.AWS_LAMBDA_FUNCTION_NAME, awsRequestId: "aws-req-1", invokedFunctionArn: "arn:aws:lambda:eu-west-2:123456789012:function:example-headers", functionVersion: "$LATEST", memoryLimitInMB: "256", getRemainingTimeInMillis: () => 9000, callbackWaitsForEmptyEventLoop: true };
const t0 = performance.now();
const res = await mod.handler(event, context);
console.log("status:", res?.statusCode, "invoke ms:", Math.round(performance.now() - t0));
await new Promise((r) => setTimeout(r, 3000));
EOF

cat > decode.mjs <<'EOF'
import { readFileSync } from "node:fs";
const lines = readFileSync(process.argv[2], "utf8").split("\n---\n").filter(Boolean).map((msg) => msg.split("\n").find((l) => /^T1[SU]/.test(l))).filter(Boolean);
lines.forEach((line) => {
  const strs = Buffer.from(line.slice(3), "base64").toString("latin1").match(/[\x20-\x7e]{4,}/g) ?? [];
  console.log(line.slice(0, 3), strs.filter((s) => /instrumentation-|^[A-Z]{3,6} |GET|POST|DynamoDB|GetItem|http\.|url|rpc\.|server\.address|undici|fetch|aws\.auth|127\.0\.0\.1/.test(s)).join(" | "));
});
EOF

cat > check-context.mjs <<'EOF'
import { readFileSync } from "node:fs";
const traceId = Buffer.from("6716a0000123456789abcdef01234567", "hex");
const parentId = Buffer.from("53995c3f42cd8ad8", "hex");
const lines = readFileSync(process.argv[2], "utf8").split("\n---\n").filter(Boolean).map((msg) => msg.split("\n").find((l) => /^T1[SU]/.test(l))).filter(Boolean);
lines.forEach((line, i) => {
  const span = Buffer.from(line.slice(3), "base64");
  console.log(`span datagram ${i + 1}: trace ID found ${span.includes(traceId)}, parent found ${span.includes(parentId)}`);
});
EOF

cat > time-init.mjs <<'EOF'
const t0 = performance.now();
const mod = await import(process.env.LAMBDA_TASK_ROOT + "/index.js");
const tImport = performance.now() - t0;
const res = await mod.handler({ resource: "/v0/headers", path: "/v0/headers", httpMethod: "GET", headers: { "x-correlation-id": "c", "x-request-id": "r" }, multiValueHeaders: {}, queryStringParameters: null, pathParameters: null, requestContext: { requestId: "r", authorizer: { pairwiseId: "u" }, path: "/v0/headers", httpMethod: "GET", resourcePath: "/v0/headers", stage: "x" }, body: null, isBase64Encoded: false }, { functionName: "example-headers", awsRequestId: "a", invokedFunctionArn: "arn:aws:lambda:eu-west-2:123456789012:function:example-headers", functionVersion: "$LATEST", memoryLimitInMB: "256", getRemainingTimeInMillis: () => 9000 });
console.log(JSON.stringify({ processUptimeMs: Math.round(process.uptime() * 1000), importMs: Math.round(tImport), status: res.statusCode }));
process.exit(0);
EOF
```

**6. Span runs.** Each run starts the listeners, runs the handler once under the layer's wrapper, and keeps the captured datagrams and the log.

```bash
run() {
  NAME=$1; ROOT=$2; shift 2
  node udp-listen.mjs "$L/udp-$NAME.txt" 14000 & U=$!
  node http-listen.mjs "$L/http-$NAME.txt" 14000 & H=$!
  node stub-upstream.mjs 14000 & S=$!
  sleep 1
  ( source ./lambda-env.sh; export LAMBDA_TASK_ROOT="$ROOT"; env "$@" ./otel-instrument-local node invoke.mjs ) > "run-$NAME.log" 2>&1
  wait $U $H $S
  echo "== $NAME: $(grep -hE 'descriptor|status:' "run-$NAME.log" | tr '\n' ' ') http bytes $(wc -c < "http-$NAME.txt")"
  node decode.mjs "udp-$NAME.txt"
}

run bundle        "$L/task"          OTEL_AWS_APPLICATION_SIGNALS_ENABLED=false
run writable      "$L/task-writable" OTEL_AWS_APPLICATION_SIGNALS_ENABLED=false
run probe-default "$L/task-probe"    OTEL_AWS_APPLICATION_SIGNALS_ENABLED=false
run probe-undici  "$L/task-probe"    OTEL_AWS_APPLICATION_SIGNALS_ENABLED=false OTEL_NODE_ENABLED_INSTRUMENTATIONS=aws-sdk,undici
run probe-lite    "$L/task-probe"    OTEL_AWS_APPLICATION_SIGNALS_ENABLED=false OTEL_NODE_ENABLED_INSTRUMENTATIONS=aws-sdk,undici OTEL_AWS_LAMBDA_FAST_START=true
node check-context.mjs udp-bundle.txt
```

| Run | What to look for | Evidence row it supports |
|---|---|---|
| `bundle` | `getter: true`, `configurable: false`, `status: 200`, `http bytes 0`; one `aws-lambda` span; `check-context.mjs` prints `trace ID found true, parent found true` | Getter-only export; layer instruments the bundle; context inherited; UDP export to the daemon address |
| `writable` | `getter: false`, the same `aws-lambda` span | Control: the getter makes no difference |
| `probe-default` | An `aws-sdk` `DynamoDB.GetItem` span inside the `aws-lambda` span, no `undici` span | `fetch` not traced by default |
| `probe-undici` | An extra `undici` `GET` span with `url.full`, `url.path` and `url.query`; the DynamoDB span lists `aws.auth.account.access_key` (its value is the dummy credential, too short for `decode.mjs` to print) | `fetch` traced with `undici`; access key ID recorded |
| `probe-lite` | The same three spans, with `http://127.0.0.1:4599/upstream?x=1` printed as the URL | `lite` produces the same spans; URL attributes recorded |

**7. Start-up timings.** Seven cold processes per mode, median of each figure. `none` runs the handler with no wrapper; the others go through the layer's wrapper. Errors go to `time-<mode>.err`, so a failed run shows why.

```bash
measure() {
  NAME=$1; WRAP=$2; shift 2
  : > "time-$NAME.err"
  for i in 1 2 3 4 5 6 7; do ( source ./lambda-env.sh; env "$@" $WRAP node time-init.mjs 2>> "time-$NAME.err" | grep processUptimeMs ); done > "time-$NAME.txt"
  node -e 'const r=require("fs").readFileSync(process.argv[1],"utf8").trim().split("\n").map(JSON.parse);const m=k=>{const v=r.map(x=>x[k]).sort((a,b)=>a-b);return v[Math.floor(v.length/2)]};console.log(process.argv[2].padEnd(8),"runs",r.length,"status",r[0].status,"median process ms",m("processUptimeMs"),"median handler import ms",m("importMs"))' "time-$NAME.txt" "$NAME"
}

measure none   ""                      X=1
measure full   ./otel-instrument-local OTEL_AWS_APPLICATION_SIGNALS_ENABLED=false
measure lite   ./otel-instrument-local OTEL_AWS_APPLICATION_SIGNALS_ENABLED=false OTEL_AWS_LAMBDA_FAST_START=true
measure appsig ./otel-instrument-local X=1
```

Each line should report 7 runs and status 200. The original results were 79, 183, 165 and 183 ms for the process, and 68 to 71 ms for the handler import. These are process start to first response on a MacBook, so expect different absolute figures elsewhere; the comparison between modes is the point.

**8. Synth check of the switch.** It builds two `FlexPublicFunction`s, one with domain variables (including `OTEL_AWS_LAMBDA_FAST_START=true`) and one passing `tracing: Tracing.DISABLED`, and prints the properties the switch affects. CDK only bundles entry files inside the repo, so both temporary files are written into `platform/infra/flex` and removed afterwards. The step ends back in the repo root.

```bash
cd "$REPO/platform/infra/flex"
echo 'export const handler = async () => ({ statusCode: 200 });' > otel-synth-entry.ts
cat > otel-synth-check.ts <<'EOF'
import { App, Aspects, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { Tracing } from "aws-cdk-lib/aws-lambda";
import { Topic } from "aws-cdk-lib/aws-sns";
import { EnableOtelTracing } from "./src/aspects/otel-tracing";
import { FlexPublicFunction } from "./src/constructs/lambda/flex-public-function";
const app = new App();
Aspects.of(app).add(new EnableOtelTracing());
const stack = new Stack(app, "Check", { env: { account: "123456789012", region: "eu-west-2" } });
const action = new SnsAction(new Topic(stack, "T"));
const entry = `${process.cwd()}/otel-synth-entry.ts`;
new FlexPublicFunction(stack, "Default", { entry, environment: { EXISTING: "kept", OTEL_AWS_LAMBDA_FAST_START: "true" }, criticalAction: action, warningAction: action });
new FlexPublicFunction(stack, "CallerDisablesTracing", { entry, tracing: Tracing.DISABLED, criticalAction: action, warningAction: action });
const fns = Template.fromStack(stack).findResources("AWS::Lambda::Function");
Object.entries(fns).forEach(([id, fn]) => {
  const p = (fn as { Properties: Record<string, unknown> }).Properties;
  console.log(JSON.stringify({ id: id.replace(/[0-9A-F]{8}$/, ""), TracingConfig: p.TracingConfig ?? null, Layers: p.Layers ?? null, Environment: p.Environment }));
});
EOF
for MODE in unset empty full lite bogus; do
  echo "== $MODE"
  case $MODE in
    unset) STAGE=check npx tsx otel-synth-check.ts 2>&1 | grep -E '^\{|Error' ;;
    empty) FLEX_OTEL_TRACING= STAGE=check npx tsx otel-synth-check.ts 2>&1 | grep -E '^\{|Error' ;;
    *) FLEX_OTEL_TRACING=$MODE STAGE=check npx tsx otel-synth-check.ts 2>&1 | grep -E '^\{|Error' ;;
  esac
done
rm otel-synth-entry.ts otel-synth-check.ts
cd "$REPO"
```

Expected:

- **Unset and empty:** no `Layers`. The first function has `TracingConfig` Active and its domain variables plus `FLEX_ENVIRONMENT=check`, which every Flex construct sets from `STAGE`. The second has `TracingConfig` null, because its caller disabled tracing.
- **`full` and `lite`:** both functions have the layer ARN, the four variables, and `TracingConfig` Active. `OTEL_AWS_LAMBDA_FAST_START` is `false` or `true` by mode, overriding the domain's `true`.
- **`bogus`:** `Error: FLEX_OTEL_TRACING must be one of full, lite; received "bogus"`.

This covers the public construct and the properties printed, not a full template comparison; it is to be replaced by tests in the suite.

**Re-run on 22 October 2026.** Steps 1 to 8 were run from this text with `$L` in the home folder. Everything held in both bash and zsh on macOS: the checksum matched; every run in step 6 matched its row, including `trace ID found true, parent found true`; the timing medians were 79, 181 to 182, 163 to 164 and 182 to 183 ms; the synth output matched for all five values; both temporary files were removed; the shell ended in the repo root; and `/tmp` was untouched. Linux was not tried; the only command that differs there is the checksum, which falls back to `sha256sum`.

**9. Gates.** From the repo root:

```bash
pnpm --filter @platform/flex run lint
pnpm --filter @platform/flex run tsc
pnpm --filter @platform/flex run test --run
```

Result when the slice was written: lint and `tsc` exit 0; tests 14 files and 72 passing.

### How the harness differs from Lambda

These differences limit what the local evidence shows. It establishes that the layer instruments the bundle under a simulated Lambda environment, not how Lambda itself loads, exports or freezes.

- The layer was unpacked to a local folder, and its `/opt` paths (in `otel-instrument`, `wrapper.mjs` and `lite-wrapper.mjs`) were rewritten to point there.
- A symlink let the ESM wrapper find the layer's modules, and a `package.json` with `"type": "commonjs"` stood in for `/var/task`.
- The AWS SDK came from the repo rather than the Lambda runtime.
- The harness imported and called the handler directly, with a made-up event, context and sampled trace header.
- A local UDP listener stood in for the X-Ray daemon, and a stub server stood in for HTTP and DynamoDB upstreams.
- The harness waited 3 seconds after the response before exiting.
- The made-up trace ID happened to contain `0123456789`, so FLEX's log sanitiser redacted `xray_trace_id` in the harness logs. Log-to-trace correlation is therefore not shown locally.
- The harness did not set `NODE_ENV=test`, so each FLEX handler run called `clearTmp()` and emptied the host's `/tmp` (see Principle 10 of the method).

---

## How to Test It Deployed

This is the measurement that decides the conversion: it fills the Baseline table, the outstanding Cost rows and most of the Open Questions. **It has not been run yet.** It was written from the repo and the layer's code without AWS access, and two reviews found and corrected errors in earlier drafts. Treat each step as `inferred` until someone has run it, and correct this section where reality differs.

It uses one personal stage in the development account, five deploys (switch unset, `full`, `full` with redaction, `lite`, then unset again) and a teardown. Allow about half a day, most of it in the cold start loop.

**What a personal stage can and can't cover.** On a personal stage the Flex constructs are used like this:

- **Isolated** (`FlexPrivateIsolatedFunction`): the `example`, `udp`, `uns` and `travel` domain routes, and the UDP and UNS service gateways (all `access: "isolated"`).
- **Egress** (`FlexPrivateEgressFunction`): the API authorizer (`stacks/platform.ts:112`), the `dvla` domain routes and the travel and DVLA service gateways (`access: "private"`).
- **Public** (`FlexPublicFunction`): no domain route uses `access: "public"` today, and the credential monitor only exists in persistent environments. **The public construct is not exercised here**; its behaviour rests on the synth check and the shared Aspect branch.

**0. Before you start.**

- AWS credentials and tooling as in `docs/environment-setup.md`, and `docs/deployment.md` for personal stages. Personal stages share the `development` core stack.
- The switch is read when CDK synthesises, so it must be set in the shell that runs the deploy.
- Use the same suites, the same number of runs and similar times of day for all three modes, so the numbers are comparable.
- Run everything from the repo root, in one shell. If you have just followed "How It Was Tested", step 8 there already returned you to the repo root.

```bash
cd "$(git rev-parse --show-toplevel)"
export AWS_REGION=eu-west-2
export STAGE=$(echo "$USER" | tr 'A-Z' 'a-z' | tr -cd 'a-z0-9-' | cut -c1-12)
stack_lambdas() { aws cloudformation describe-stack-resources --stack-name "$1" --query "StackResources[?ResourceType=='AWS::Lambda::Function'${2:-}].PhysicalResourceId" --output text; }
measured() {
  for d in example udp uns travel dvla; do stack_lambdas "${STAGE}-$d"; done
  stack_lambdas "${STAGE}-FlexPlatform" " && (contains(LogicalResourceId, 'AuthorizerFunction') || contains(LogicalResourceId, 'ServiceGateway'))"
}
layers() { for f in $(measured); do echo "$f $(aws lambda get-function-configuration --function-name "$f" --query 'Layers[].Arn' --output text)"; done; }
```

`STAGE` follows `sanitiseStageName` in `libs/utils/src/infra/index.ts`. `measured` lists the functions this test measures: every Lambda in the five domain stacks, plus the authorizer and the service gateways from the platform stack. It deliberately leaves out the platform stack's other Lambdas (the JWKS stub, the `CfnPause` function and its CDK provider), which are not Flex constructs and never take the layer. A stack that doesn't exist on your stage prints an error; drop that domain from the loop.

**1. Deploy the baseline, with the switch unset.**

```bash
unset FLEX_OTEL_TRACING
pnpm run deploy
layers
```

`pnpm run deploy` from the repo root also runs `openapi:generate` first. No function should show the `AWSOpenTelemetryDistroJs` layer.

**2. Generate traffic.** The e2e suites already handle authentication and call real routes through CloudFront and API Gateway, which also invokes the authorizer. `--run` is needed: without it, vitest stays in watch mode in a terminal and the loop below never moves on.

```bash
traffic() {
  pnpm --filter @flex/example-domain run test:e2e --run
  pnpm --filter @flex/udp-domain run test:e2e --run
  pnpm --filter @flex/uns-domain run test:e2e --run
  pnpm --filter @flex/travel-domain run test:e2e --run
  pnpm --filter @flex/dvla-domain run test:e2e --run
}
traffic
```

Check every suite passes on the baseline before going on. If one can't pass on a personal stage, for example because it needs upstream test data, remove it from `traffic` and note which construct is then uncovered (without `dvla`, the only egress functions left are the authorizer and the travel gateway).

**3. Force cold starts, aiming for at least 20 per function.** Updating a function's configuration makes Lambda start new execution environments for the next invocations. Changing only the description does this without touching code or variables. Step 4 counts the cold starts it actually got; a function with far fewer than 20 either wasn't called by the suites (leave it out of the results) or wasn't cold-started by the description change (change an environment variable on that one instead).

```bash
export START=$(date +%s)
for i in $(seq 1 20); do
  for f in $(measured); do aws lambda update-function-configuration --function-name "$f" --description "cold start run $i" > /dev/null || echo "update failed: $f"; done
  for f in $(measured); do aws lambda wait function-updated --function-name "$f"; done
  traffic
done
for f in $(measured); do aws lambda update-function-configuration --function-name "$f" --description "" > /dev/null || echo "reset failed: $f"; done
export END=$(date +%s)
```

**4. Collect `Init Duration` and `Duration`.** The Flex constructs give each function its own log group, so the query looks each one up rather than assuming `/aws/lambda/<name>`. Each query is polled until it finishes, so partial results are never saved.

```bash
report() {
  for f in $(measured); do
    LG=$(aws lambda get-function-configuration --function-name "$f" --query LoggingConfig.LogGroup --output text)
    Q=$(aws logs start-query --log-group-name "$LG" --start-time "$START" --end-time "$END" \
      --query-string 'filter @type = "REPORT" | stats count(@initDuration) as coldStarts, pct(@initDuration, 50) as initP50, pct(@initDuration, 95) as initP95, pct(@duration, 95) as durationP95, count() as invocations' \
      --query queryId --output text)
    S=Running
    while [ "$S" = "Running" ] || [ "$S" = "Scheduled" ]; do
      sleep 2
      S=$(aws logs get-query-results --query-id "$Q" --query status --output text)
    done
    echo "$f $S $(aws logs get-query-results --query-id "$Q" --query 'results[0][].[field,value]' --output text | tr '\n\t' '  ')"
  done
}
report | tee "baseline-$(date +%Y%m%d-%H%M).txt"
```

Every line should say `Complete`. A complete line with no figures means the function had no invocations in the window. Save the file, because the record's Principle 11 needs it.

**5. API Gateway latency.** The public API's stage is called `prod` on every stage (`STAGE_NAME` in `stacks/platform.ts:45`), and its metrics are keyed by API name and stage.

```bash
API_ID=$(aws cloudformation describe-stack-resources --stack-name "${STAGE}-FlexPlatform" --query "StackResources[?ResourceType=='AWS::ApiGateway::RestApi' && starts_with(LogicalResourceId, 'Api')].PhysicalResourceId" --output text)
API_NAME=$(aws apigateway get-rest-api --rest-api-id "$API_ID" --query name --output text)
echo "$API_NAME"
iso() { node -e 'console.log(new Date(Number(process.argv[1]) * 1000).toISOString())' "$1"; }
aws cloudwatch get-metric-statistics --namespace AWS/ApiGateway --metric-name Latency \
  --dimensions Name=ApiName,Value="$API_NAME" Name=Stage,Value=prod \
  --start-time "$(iso "$START")" --end-time "$(iso "$END")" --period $(( (END - START + 59) / 60 * 60 )) --extended-statistics p95
```

The API sets no explicit name, so CDK may name it after its construct (`Api`) on every stage. If the printed name isn't unique to your stage, this metric mixes every stage in the account; skip it and rely on Lambda `Duration` and the trace timeline. CloudFront sits in front, so this is the API's own latency, not what a client sees.

**6. Look at the traces in X-Ray.** In the CloudWatch console, open Traces for the same window and filter on `example`'s `users/notifications` route (it calls the UDP domain and the UNS gateway) and on a `travel` route (it calls the egress travel gateway). For one trace of each, record:

- the number of segments and subsegments, and the deepest nesting level (the ticket's "about 15 levels");
- whether the Lambda segments sit under the API Gateway segment in one trace;
- whether the calls between functions appear as subsegments.

In the baseline, expect API Gateway and Lambda segments only, since FLEX has no X-Ray SDK in code.

**7. Deploy `full` and repeat.**

```bash
export FLEX_OTEL_TRACING=full
pnpm run deploy
layers
```

Every function `measured` lists should now show the layer. One that doesn't is not a Flex construct; remove it from the results. Then repeat steps 2 to 6, saving the report as `full-...`. In X-Ray, also check:

- spans from `aws-lambda`, `aws-sdk` and `undici` sit in the same trace as API Gateway;
- isolated functions' spans (`example`, the UDP and UNS gateways) are present, compared with egress functions' spans (the authorizer, the travel gateway). Missing spans from isolated functions only, while egress ones arrive, is evidence that delivery from isolated subnets fails; record it and investigate (export errors in the function's log) before concluding why;
- the attributes on `undici` spans (`url.full`, `url.path`, `url.query`) and AWS SDK spans (`aws.auth.account.access_key`). Note which values are personal or sensitive, for the security conversation.

**8. Check redaction in `full` mode.** The layer reads `AWS_REDACT_SPAN_ATTRIBUTES` as a comma-separated list of attribute names, with `*` as a wildcard, and replaces each value with `REDACTED` (the layer's `AttributeRedactingSpanProcessor`). Domain configuration reaches only that domain's own functions, so this tests the `example` functions; the UNS gateway's spans, which carry `externalUserID` in `url.query`, are not covered by it. Add the variable temporarily to the `example` domain's `common.function.environment` in `domains/example/domain.config.ts`:

```ts
environment: {
  key: "value",
  AWS_REDACT_SPAN_ATTRIBUTES: "url.full,url.path,url.query,aws.auth.account.access_key",
},
```

Deploy with `FLEX_OTEL_TRACING=full`, run `traffic` once, and check those attributes now read `REDACTED` on the `example` functions' spans. Then remove the line again; it is not part of the slice. Redacting gateway spans would need the variable in the platform construct or the gateway configuration, which is a decision for the rollout, not this test.

**9. Deploy `lite` and repeat.**

```bash
export FLEX_OTEL_TRACING=lite
pnpm run deploy
layers
```

Repeat steps 2 to 6, saving the report as `lite-...`. Then compare `full` and `lite` for span loss when Lambda freezes the environment. X-Ray samples requests, so compare only **sampled** invocations of the same route: for each mode, the share of sampled `users/notifications` traces that contain the expected `undici` spans, and the span count per trace. A lower share in `lite` is evidence of possible loss; check sampling and export errors before attributing it to freezing.

**10. Revert and clean up.**

```bash
unset FLEX_OTEL_TRACING
pnpm run deploy
layers
```

No function should show the layer. That is the measured revert for the Cost table. Remove the stage with `pnpm --filter @platform/flex destroy` when finished.

**11. Record the results** in the Baseline and Cost tables, and commit the saved report files beside this record:

| Measure | Function | Baseline | `full` | `lite` |
|---|---|---|---|---|
| Cold starts collected | each measured function | | | |
| `Init Duration` p50 / p95 (ms) | authorizer (egress), `example` route (isolated), UDP gateway (isolated), travel gateway (egress) | | | |
| `Duration` p95 (ms) | same | | | |
| API Gateway `Latency` p95 (ms) | public API, if its name is unique to the stage | | | |
| Trace depth (levels) and subsegments | `GET /example/v0/users/notifications`, one `travel` route | | | |
| Isolated function spans reach X-Ray | `example`, UDP and UNS gateways | n/a | | |
| Trace joins API Gateway segment | same routes | | | |
| Redaction works | `example` | n/a | | n/a |
| Sampled traces with expected `undici` spans (%) | `users/notifications` | n/a | | |

**What this does not cover.**

- **The public construct**, as above.
- **Staging and production.** They have provisioned concurrency on gateways and 1,024 MB on domain functions, and only CI deploys there, which doesn't carry the switch yet. Pre-warmed environments initialise before any request arrives, so their start-up does not appear as `Init Duration` on ordinary REPORT lines; measure them separately from on-demand cold starts, and confirm which log line carries their initialisation time when deployed.
- **Outbound trace headers.** X-Ray doesn't record request headers, so whether `traceparent`, `X-Amzn-Trace-Id` and `baggage` reach third parties needs the upstream's own logs, or a local run against a stub that logs headers.
- **X-Ray cost.** Take the trace and span counts from this run and the X-Ray pricing page, cited with its date.

---

## Cost

Estimates are the figures FLEX gave this approach (option B1) in its options assessment before the spike. That assessment is not in this repository, and the figures were never measured; they are kept only so the actuals can be compared with what was expected. Where only progress is known, the Actual column says so; no active effort was recorded per phase.

| Type | Measure | Estimate | Actual | Evidence |
|---|---|---|---|---|
| One-off | Add the layer, wrapper and policy to the constructs | 0.5 day | Done in the slice; synthesised with the layer and variables, and no policy added. That the existing permissions are enough with Application Signals off is `inferred` until deployed | `measured` (synth), `inferred` (permissions) |
| One-off | Configure variables and test basic tracing | 0.5 day | Done locally; deployed test outstanding | `measured` (local) |
| One-off | Resolve layer, esbuild and handler compatibility | 1 to 3 days | No change was needed locally; the deployed runtime may still differ (see the harness differences) | `measured` (local) |
| One-off | Validate trace quality against native X-Ray | 1 day | Outstanding, needs a deployed stage | |
| One-off | Manual spans for function-level depth | 3 to 5 days | Not started | |
| One-off | Cold start testing | 1 day | Local figures only; deployed measurement needed for development and staging separately | `measured` (local) |
| One-off | CI switch per environment | not in the estimate | Not started | `traced` (workflows) |
| One-off | Data classification of span attributes | not in the estimate | Not started | |
| One-off | Change size | n/a | 2 files, 94 lines added, 0 removed | `measured` |
| One-off | Iterations | n/a | Harness: 8 failed runs (module resolution, module type, invocation path, argument order, lite wrapper path) before valid results. Slice: 1 lint failure (number in a template literal), then 2 review fixes | `reported` (failure logs not kept) |
| One-off | Effort | 7 to 11 days (B1 total) | AI-assisted session on 21 October 2026: branch 14:38, slice verified locally 14:57, review fixes applied by 15:33, plus layer research before and the documents after. Elapsed time only; active effort per phase was not recorded, and this is not a team estimate | `reported` |
| Recurring runtime | Start-up overhead | Unmeasured | +86 ms (`lite`), +104 ms (`full`) locally; Lambda figure outstanding | `measured` (local) |
| Recurring runtime | Package size | Unmeasured | +7.17 MB per function (2.7% of the limit) | `measured` |
| Recurring runtime | X-Ray cost | Not estimated | Outstanding; needs trace volumes, including retry spans, and the X-Ray pricing page | |
| Recurring operational | New dependency | 1 | 1 AWS-published layer, pinned to version 16. The two releases checked (v0.12.0 on 30 June, v0.13.0 on 22 September 2026) were about 12 weeks apart; the future cadence is not established | `traced` |
| Recurring operational | Permissions and network | Unknown | None with Application Signals off; isolated delivery outstanding | `inferred` |
| Exit | Revert | n/a | Unset `FLEX_OTEL_TRACING` and redeploy. The synth shows the unset template has no layer or variables; that a redeploy leaves nothing behind is to be confirmed by deployed step 10 | `measured` (synth), `inferred` (deployed) |

---

## Difficulty Profile

| Dimension | Score | Why |
|---|---|---|
| Breadth | 3 | Three constructs change, but through 9 call sites they reach every domain and gateway function, the authorizer and three platform functions ("every domain" is a 3 in the method) |
| Depth | 1 | Configuration only; no handler or library call site changes |
| Unknowns | 3 | Isolated delivery, Lambda `Init Duration`, the runtime's own loading path, export before freeze in `lite`, and cost can only be answered on a deployed stage |
| Verifiability | 3 | Locally only a harness and synth; trace quality and timings need a deployed environment, and staging needs its own measurement |
| Reversibility | 1 | Unset the switch and redeploy |
| Coupling | 3 | Cloud Platform owns the spike, security needs to agree the span attributes, and the layer is published by AWS |
| Constraints | 3 | Isolated network with no X-Ray endpoint; span attributes need data classification, and `lite` can't redact them; CI must carry the switch |

Overall: **3**, from Breadth, Unknowns, Verifiability, Coupling and Constraints. The work itself is small (Depth 1, Reversibility 1). What makes it hard is that it reaches everything at once, and that the remaining answers need a deployed stage and other teams.

---

## Extrapolation

The constructs are shared, so the slice already covers every Flex function and the per-domain multiplier is 0 for the base conversion. What remains:

- **Fixed:**
  - Deployed verification: one in development, and separate measurements in staging, because of provisioned concurrency, memory size and the stacks a personal stage doesn't build.
  - The CI switch per environment.
  - The data classification of span attributes, with redaction configured in `full` mode.
- **Per domain:** manual spans, only where function-level depth is wanted. This is the only part that scales with the number of domains, and it is optional.
- **Uncertainty:** locally, compatibility needed no work, and that was the estimate's biggest range (1 to 3 days). The harness differs from Lambda in the ways listed above, so that range should only come off the estimate once the deployed test agrees. The CI and classification work is new and not in the original estimate.

---

## Open Questions

| Question | How to answer | Who |
|---|---|---|
| Do spans from isolated functions reach X-Ray without an X-Ray VPC endpoint? | "How to Test It Deployed", step 7: compare spans from isolated functions with spans from egress functions in the same run | FLEX |
| What is the `Init Duration` overhead in Lambda for `full` and `lite`, with and without provisioned concurrency? | On-demand cold starts from `Init Duration` on REPORT lines ("How to Test It Deployed", steps 3 and 4). Provisioned environments initialise before any request, so measure them separately in staging, and confirm there which log line carries their initialisation time | FLEX |
| Does the Lambda Node.js 24 runtime load the handler in a way the layer patches, as the harness did? | Same deployment; check for the `aws-lambda` span | FLEX |
| Do OpenTelemetry spans join the API Gateway segment in one trace? | Same deployment; open one trace from API Gateway to the gateway call | FLEX |
| Does `lite` send its spans before Lambda freezes the environment? | Compare, for sampled invocations of the same route only, the share of traces with the expected spans in `full` and `lite` ("How to Test It Deployed", step 9) | FLEX |
| How deep are traces with auto-instrumentation alone, against the ticket's "about 15 levels"? | Trace one gateway call end to end; count levels | FLEX with Cloud Platform |
| What does X-Ray cost with the extra spans, including retries? | Trace volumes from the deployed stage and the X-Ray pricing page, cited with its date | FLEX |
| Which span attributes may go to X-Ray (`url.full`, `url.path`, `url.query`, `aws.auth.account.access_key`)? | Check against `docs/data-classification-and-encryption.md`; test `AWS_REDACT_SPAN_ATTRIBUTES` in `full` mode | FLEX with security |
| Should outbound calls carry trace headers, and which (`X-Amzn-Trace-Id`, `traceparent`, `baggage`)? | Decide whether third parties may receive them; if not, set `OTEL_PROPAGATORS` (for example to `xray`, or `none`) in `aspects/otel-tracing.ts` | Security |
| Does Lambda code signing (PLAT-713, `feat/PLAT-713-lambda-code-signing`, not merged) accept the AWS-published layer? | If code signing is enforced on the Flex constructs, an attached layer must be signed by an allowed profile; check the branch's `UntrustedArtifactOnDeployment` setting and test with both enabled. `inferred` from AWS's documented behaviour; the branch has not been read. Whichever change merges second handles it | FLEX with Cloud Platform |
| How should the switch be set per environment in CI? | Agree whether it becomes an environment setting in `_build-deploy.yml` or a code default | FLEX |
| Is Application Signals wanted? | It is off in the slice; enabling it needs `CfnDiscovery`, the managed policy and a permissions boundary review | Cloud Platform |

---

## Decision

Not decided. Take the baseline on a personal stage with the switch unset, then measure `full` (with redaction) and `lite`, fill in the Baseline and the outstanding Cost rows, agree the span attributes and outbound headers with security, then record the decision here: what was decided, the date, who decided, and the evidence it rests on.
