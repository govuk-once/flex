# Spike: OTEL (ADOT) Tracing vs Native X-Ray

## Current State of Tracing in Flex

Flex has **infrastructure-level X-Ray only** — no application-level tracing SDK is installed.

| What's traced today | How |
|---|---|
| API Gateway request/response | CDK `tracingEnabled: true` on both public and private REST APIs |
| Lambda invocation duration + cold starts | CDK `Tracing.ACTIVE` on all 3 Lambda construct types |
| Downstream calls (HTTP, DynamoDB, AWS SDK) | **Not traced at all** |
| Custom spans/subsegments | **None exist** |

The X-Ray trace graph today shows only: `API Gateway → Lambda` (single hop). There is zero visibility into what the Lambda does internally — no flame graph depth, no downstream call breakdown.

Observability is currently **log-based**: Powertools Logger with a custom `@flex/telemetry` library that emits structured events to CloudWatch Logs. The X-Ray trace ID is included in log output for correlation, and `x-correlation-id` headers propagate across service calls.

---

## Option A: Stay with Native X-Ray (Add the X-Ray SDK)

### What it takes

Install `aws-xray-sdk-core` and patch the AWS SDK + HTTP clients at the application level.

```
pnpm add aws-xray-sdk-core
```

**Instrumentation approach:**

```typescript
// In a shared bootstrap file or middleware
import AWSXRay from 'aws-xray-sdk-core';
import https from 'https';

AWSXRay.captureHTTPsGlobal(https);
// AWS SDK v3 clients need individual wrapping via captureAWSv3Client()
```

### Pros

- **Minimal change** — X-Ray is already enabled at infra level; adding the SDK just fills in the subsegments
- **No new infrastructure** — no collector, no Lambda layer, no sidecar
- **Deepest automatic flame graphs** — X-Ray SDK for Node.js auto-instruments AWS SDK calls and HTTP calls with full subsegment detail (the 15-level-deep flame graphs the ticket references)
- **Zero cold start overhead** — the SDK is lightweight (~2-5ms init)
- **Works with existing IAM** — `xray:PutTraceSegments` and `xray:PutTelemetryRecords` already granted in permissions boundaries
- **Log-to-trace correlation already exists** — the `xray_trace_id` is already injected into logs by `@flex/logging`

### Cons

- **Vendor lock-in** — tied to AWS X-Ray as the trace backend
- **No path to multi-backend** — can't fan out traces to Datadog, Jaeger, Grafana Tempo, etc. without rework
- **AWS SDK v3 wrapping is manual per client** — each DynamoDB/SSM/SecretsManager/STS client must be individually wrapped with `captureAWSv3Client()`
- **X-Ray has sampling limits** — default 1 req/sec + 5% reservoir; high-throughput services may miss traces
- **X-Ray console UX** — trace analysis tooling is functional but basic compared to Grafana Tempo or Jaeger

### Estimated effort

| Task | Effort |
|---|---|
| Add `aws-xray-sdk-core` to `@flex/sdk` and `@flex/service-gateway` | 0.5 day |
| Patch HTTP + AWS SDK clients in middleware | 0.5 day |
| Verify traces across all domain patterns (public, private, gateway) | 1 day |
| **Total** | **~2 days** |

---

## Option B: ADOT (AWS Distro for OpenTelemetry)

### What it takes

Add the ADOT Lambda Layer which auto-instruments Node.js Lambda functions using OpenTelemetry, and export traces to X-Ray (or any OTEL-compatible backend).

**Two sub-approaches:**

#### B1: ADOT Lambda Layer (auto-instrumentation, zero code changes)

Add the ADOT Lambda Layer to all Lambda constructs and set environment variables:

```typescript
// In Lambda constructs (CDK)
import { LayerVersion } from 'aws-cdk-lib/aws-lambda';

const adotLayer = LayerVersion.fromLayerVersionArn(
  this, 'AdotLayer',
  'arn:aws:lambda:eu-west-2:901920570463:layer:aws-otel-nodejs-arm64-ver-1-30-1:1'
);

// Add to function
layers: [adotLayer],
environment: {
  AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-handler',
  OTEL_TRACES_EXPORTER: 'otlp',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318', // ADOT collector in the layer
  OTEL_SERVICE_NAME: serviceName,
  OTEL_PROPAGATORS: 'xray',
  OTEL_TRACES_SAMPLER: 'xray',
}
```

#### B2: Manual OTEL SDK (full control)

Install `@opentelemetry/api`, `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, and the X-Ray propagator/exporter:

```
pnpm add @opentelemetry/api @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/propagator-aws-xray \
  @opentelemetry/id-generator-aws-xray
```

### Pros

- **Vendor-neutral** — traces can go to X-Ray, Datadog, Grafana Tempo, Jaeger, etc. simultaneously
- **Industry standard** — OTEL is the CNCF standard; broad ecosystem and community
- **Future-proof** — if Flex ever moves off AWS or adds a third-party APM tool, the instrumentation stays
- **Auto-instrumentation** — the ADOT layer patches HTTP, AWS SDK, and common libraries automatically (B1 approach)
- **Richer context propagation** — W3C Trace Context headers alongside X-Ray headers

### Cons

- **Cold start impact is significant** — the ADOT Lambda Layer adds **200-800ms to cold starts** (the OTEL SDK initialises all auto-instrumentations at startup). For a Node.js 24 Lambda this is substantial.
  - Flex Lambda functions currently have p99 duration alarms at 80% of timeout
  - Service gateways have provisioned concurrency (2) which mitigates but doesn't eliminate
  - Domain Lambdas without provisioned concurrency will feel this on every cold start
- **Shallow flame graphs by default** — OTEL auto-instrumentation captures HTTP calls and AWS SDK calls as spans, but does NOT produce the same depth of subsegment detail as the native X-Ray SDK. You get: `Lambda → HTTP call` or `Lambda → DynamoDB.PutItem`, but not the internal function-level breakdown that X-Ray SDK's `captureAsyncFunc` provides.
  - **To match X-Ray flame graph depth, you need manual span creation** throughout the codebase
- **Lambda Layer size** — ADOT layer is ~50MB compressed, eating into the 250MB unzipped deployment package limit
- **Additional infrastructure for non-X-Ray backends** — if exporting to anything other than X-Ray, need an OTEL Collector (ECS/Fargate sidecar or standalone), which conflicts with Flex's 100% serverless architecture
- **ESM compatibility issues** — OTEL auto-instrumentation has [known issues with ESM modules](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/#esm-support). Flex uses `"type": "module"` throughout. The ADOT layer's `--require` hook may not patch ESM imports correctly, requiring the experimental `--import` loader or `@opentelemetry/instrumentation/hook.mjs`.
  - This is the **biggest technical risk** — ESM + OTEL auto-instrumentation is still experimental in the Node.js OTEL SDK
- **Increased package size and dependency surface** — OTEL SDK brings in dozens of transitive dependencies
- **Configuration complexity** — environment variables, propagators, samplers, exporters all need configuration and testing per environment
- **VPC endpoint needed** — if using OTLP exporter to an external collector, isolated Lambda functions have no internet access and would need a new VPC endpoint or architecture change

### Estimated effort

| Task | Effort |
|---|---|
| **B1: ADOT Layer approach** | |
| Add ADOT Lambda Layer to CDK constructs | 0.5 day |
| Configure env vars and test basic tracing | 0.5 day |
| Resolve ESM compatibility issues | 1-3 days (high uncertainty) |
| Validate trace quality vs native X-Ray | 1 day |
| Add manual spans for flame graph parity | 3-5 days (across all domains) |
| Performance testing (cold start impact) | 1 day |
| **B1 Total** | **6-10 days** |
| | |
| **B2: Manual OTEL SDK approach** | |
| All of B1 plus SDK setup, exporter config | +2-3 days |
| **B2 Total** | **8-13 days** |

---

## Head-to-Head Comparison

| Dimension | Native X-Ray SDK | ADOT / OTEL |
|---|---|---|
| **Cold start overhead** | ~2-5ms | ~200-800ms |
| **Flame graph depth (out of box)** | Deep — auto-instruments AWS SDK calls with full subsegment detail | Shallow — top-level HTTP/SDK calls only |
| **Manual instrumentation needed for parity** | Minimal — `captureAWSv3Client()` per client | Significant — custom spans throughout |
| **ESM compatibility** | Stable | Experimental / risky |
| **Vendor lock-in** | AWS X-Ray only | Any OTEL-compatible backend |
| **Lambda Layer required** | No | Yes (50MB+) |
| **Dependency footprint** | 1 package | 10-15+ packages |
| **Implementation effort** | ~2 days | ~6-13 days |
| **Ongoing maintenance** | Low — AWS manages SDK | Medium — OTEL SDK versions, layer updates, ESM compat tracking |
| **Multi-backend support** | No | Yes |
| **Community/ecosystem** | AWS-specific | CNCF standard, broad ecosystem |

---

## Critical Findings

### 1. Flex has no deep traces today — either approach is a net-new investment

The spike premise assumes we're "swapping" from X-Ray to OTEL. In reality, **we have no application-level tracing at all**. Both options require adding instrumentation from scratch. The question is which SDK to add, not what to replace.

### 2. ESM is the biggest blocker for OTEL

Flex is fully ESM (`"type": "module"` in every package). OTEL auto-instrumentation relies on `require()` monkey-patching which does not work with ESM imports. The Node.js OTEL SDK's ESM support is experimental and uses `--import` loader hooks. This is the single highest-risk item and could consume the entire 3-day timebox just to get working.

### 3. Cold start penalty is real and measurable

The ADOT layer initialises all registered instrumentations at Lambda cold start. For Flex Lambdas without provisioned concurrency (which is most of them), this adds hundreds of milliseconds to every cold start. This directly impacts the p99 latency alarms already configured.

### 4. OTEL does not give deeper flame graphs — it gives shallower ones

A common misconception is that OTEL provides richer traces. For Lambda + Node.js, the native X-Ray SDK actually produces **more detailed** subsegments than OTEL auto-instrumentation. OTEL gives you spans for HTTP calls and AWS SDK operations, but lacks the function-level `captureAsyncFunc` depth that X-Ray SDK provides.

### 5. There is no immediate need for multi-backend export

Flex uses CloudWatch + X-Ray for all observability. There's no Datadog, Grafana, or Jaeger in the stack. The main advantage of OTEL (vendor neutrality) has no current consumer. If a multi-backend requirement emerges later, migrating from X-Ray SDK to OTEL SDK is a known, bounded task.

---

## Recommendation

**Add the native X-Ray SDK (`aws-xray-sdk-core`) now. Revisit OTEL when there's a concrete multi-backend requirement or when OTEL ESM support matures.**

### Rationale

| Factor | Verdict |
|---|---|
| Dev effort | X-Ray: ~2 days vs OTEL: 6-13 days |
| Risk | X-Ray: low, well-understood vs OTEL: high (ESM compat) |
| Trace quality | X-Ray wins on depth and detail |
| Cold start impact | X-Ray: negligible vs OTEL: 200-800ms |
| Vendor neutrality | OTEL wins, but no current need |
| Parity with current setup | Both are net-new; X-Ray is additive to the existing infra config |

### Suggested implementation path

1. Add `aws-xray-sdk-core` as a dependency of `@flex/sdk` and `@flex/service-gateway`
2. Create a shared tracing bootstrap in the Middy middleware chain that patches HTTP and AWS SDK clients
3. Use `captureAWSv3Client()` on DynamoDB, SSM, SecretsManager, STS, and EventBridge clients in the service gateway library
4. Add custom subsegments for the service gateway → external API call path (DVLA, UDP, UNS, Travel)
5. Validate trace depth across all domain patterns in the dev environment
6. No CDK changes needed — `Tracing.ACTIVE` and IAM permissions are already in place

### When to reconsider OTEL

- A decision to adopt Datadog, Grafana Tempo, or another APM tool
- Node.js OTEL SDK ESM support reaches stable status
- AWS announces X-Ray SDK deprecation in favour of OTEL (no indication of this currently)
- Cross-cloud or multi-provider tracing becomes a requirement
