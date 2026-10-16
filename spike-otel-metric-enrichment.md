# Spike: OTEL Metric Enrichment — Evaluation

## What Is OTEL Metric Enrichment?

This is a **CloudWatch account-level setting** — not an SDK, not a Lambda layer, not a code change.

When enabled, CloudWatch takes the AWS-vended metrics that services like Lambda and API Gateway already emit (Duration, Errors, Latency, 4XXError, etc.) and produces an **OTEL-format copy** enriched with resource attributes (tags). These enriched metrics are queryable with **PromQL** and **SQL** alongside the regular CloudWatch metrics, which remain unchanged.

**What it is not:** This is not ADOT, not the OTEL SDK, and not auto-instrumentation. No Lambda layer, no `AWS_LAMBDA_EXEC_WRAPPER`, no application code changes. The ESM compatibility issues and cold start penalties from the tracing spike do not apply here.

---

## Current State of Metrics in Flex

### Dashboards

Two CloudWatch dashboards exist, both built from JSON definitions:

| Dashboard | Namespace | What it shows |
|---|---|---|
| `{env}-flex-driving-dashboard` | `AWS/ApiGateway` | DVLA endpoints (6), DVLA service gateway, identity endpoints — request counts, success/error rates, p50/p90/p99/avg latency |
| `{env}-flex-udp-dashboard` | `AWS/ApiGateway` | UDP service gateway, UDP endpoints, identity endpoints — same widget pattern |

Every widget queries `AWS/ApiGateway` metrics with dimensions: `ApiName` (Api or PrivateGateway), `Resource` (path), `Stage` (prod), `Method` (GET/POST/DELETE).

Widget patterns per endpoint:
- Time-series of request counts (5-min period, Sum) with computed "Successful Requests" = total - 4xx - 5xx
- Latency percentile time-series (p50, p90, p99, Average)
- Single-value summary: Success Rate %, 4XX Rate %, 5XX Rate % over 30 days

### Alarms

Extensive alarm constructs covering 10 AWS namespaces:

| Construct | Namespace | Key metrics |
|---|---|---|
| Lambda | `AWS/Lambda` | Errors, Invocations, Throttles, Duration (p99) |
| API Gateway | `AWS/ApiGateway` | 5XXError, 4XXError, Latency (p95), IntegrationLatency (p95) |
| CloudFront | `AWS/CloudFront` | 5xxErrorRate, 4xxErrorRate, TotalErrorRate |
| CloudFront Functions | `AWS/CloudFront` | FunctionExecutionErrors, FunctionThrottles |
| WAF | `AWS/WAFV2` | BlockedRequests, AllowedRequests (anomaly detection) |
| Shield | `AWS/DDoSProtection` | DDoSDetected, DDoSAttackRequestsPerSecond |
| Certificate | `AWS/CertificateManager` | DaysToExpiry |

### Custom metrics (2 namespaces)

| Namespace | Metrics | Emitter |
|---|---|---|
| `Flex/Credentials` | SecretRotationOverdue, CognitoConfigDrift, etc. | credential-monitor Lambda via PutMetricData |
| `Flex/SmokeTest` | SmokeTestSuccess | smoke-test Lambda via PutMetricData |
| `Flex/ApiGateway` | auth-failures (dynamic name) | MetricFilter on access logs |

---

## How to Enable (for the Spike)

### Step 1: Enable vended metric enrichment (account-level)

In a non-prod AWS account:

```bash
# Via AWS CLI
aws cloudwatch put-metric-enrichment \
  --enrichment-type OTEL_VENDED_METRICS \
  --status ENABLED \
  --region eu-west-2
```

Or in the CloudWatch console: **Settings → Metric enrichment → Enable**.

No CDK changes. No Lambda changes. No redeployment.

### Step 2: Wait for metrics to appear

Once enabled, enriched metrics appear within minutes. They show up in the CloudWatch console under a dedicated OTEL metrics section, queryable via PromQL or SQL.

### Step 3: Re-graph an existing widget with PromQL

**Suggested candidate: DVLA `/app/dvla/v1/customer/vehicles` latency and throughput** — this is the most-used endpoint widget on the driving dashboard and exercises all the patterns (counts, error rates, latency percentiles).

---

## Re-Graphing Exercise: DVLA Vehicles Endpoint

### Current CloudWatch JSON (from drivingDashboard.json)

The existing widget uses 4 separate metric queries with a math expression:

```
Namespace: AWS/ApiGateway
Dimensions: ApiName=Api, Resource=/app/dvla/v1/customer/vehicles, Stage=prod, Method=GET
Metrics: Count (Sum), 4XXError (Sum), 5XXError (Sum)
Math: total - e4xx - e5xx = "Successful Requests"
Period: 300s
```

### Equivalent PromQL queries

**Request throughput (5-min rate):**
```promql
sum(rate(aws_apigateway_count_total{
  api_name="Api",
  resource="/app/dvla/v1/customer/vehicles",
  method="GET"
}[5m]))
```

**Error rates by type:**
```promql
sum(rate(aws_apigateway_5xx_error_total{
  api_name="Api",
  resource="/app/dvla/v1/customer/vehicles",
  method="GET"
}[5m]))
```

**P99 latency:**
```promql
histogram_quantile(0.99,
  rate(aws_apigateway_latency_bucket{
    api_name="Api",
    resource="/app/dvla/v1/customer/vehicles",
    method="GET"
  }[5m])
)
```

**Cross-endpoint latency comparison (new — not possible in current dashboard without duplicating widgets):**
```promql
# Compare p99 latency across ALL DVLA endpoints in one widget
histogram_quantile(0.99,
  sum by (resource, le) (
    rate(aws_apigateway_latency_bucket{
      api_name="Api",
      resource=~"/app/dvla/.*",
      method="GET"
    }[5m])
  )
)
```

**Cross-domain error rate comparison (new):**
```promql
# Error rates for every domain in one query
sum by (resource) (
  rate(aws_apigateway_5xx_error_total{api_name="Api"}[5m])
)
```

---

## Capabilities Comparison

### What PromQL + resource tags enable that CloudWatch Metrics cannot do easily

| Capability | CloudWatch Metrics | PromQL on OTEL Metrics |
|---|---|---|
| **Regex filtering on dimensions** | Not supported — must select exact dimension values from dropdowns | `resource=~"/app/dvla/.*"` matches all DVLA endpoints |
| **Cross-resource aggregation** | Requires separate metric per resource, then METRIC_MATH | `sum by (resource) (rate(...))` in one query |
| **Ad-hoc grouping** | Fixed dimensions — can only group by what was emitted | `by (method)`, `by (api_name)`, `by (resource)` dynamically |
| **Rate calculations** | METRIC_MATH with period alignment | Native `rate()`, `irate()`, `increase()` |
| **Tag-based filtering** | Only on pre-defined dimensions | Filter by any resource attribute including custom AWS tags (environment, team, domain) |
| **Top-N queries** | Not supported natively | `topk(5, rate(aws_lambda_errors_total[5m]))` — top 5 erroring functions |
| **Dashboard creation effort** | JSON per-widget, per-metric, verbose | Compact PromQL strings, one query can replace 3-4 CloudWatch metric definitions |

### What CloudWatch Metrics does that PromQL cannot

| Capability | CloudWatch Metrics | PromQL on OTEL Metrics |
|---|---|---|
| **Anomaly detection bands** | Native `AnomalyDetectionAlarm` (used in WAF alarms) | Not available in PromQL |
| **Alarm integration** | Full native support | PromQL alarms are newer, not all alarm types supported yet |
| **Metric math expressions** | Mature, full `IF()`, `FILL()`, conditional logic | PromQL has equivalents but less flexible for CloudWatch-specific patterns |
| **Console discoverability** | Browse by namespace → dimension → metric | Must know metric names and label keys |

### Verdict on query experience

PromQL is meaningfully better for **exploratory querying and dashboard building**. The regex matching and dynamic grouping alone eliminate the biggest friction with CloudWatch Metrics — having to manually select each resource/dimension combination from dropdowns.

For **alarms**, the current CloudWatch approach is more mature. No reason to migrate alarms to PromQL.

---

## Cost Analysis

### Pricing model

| Item | Cost |
|---|---|
| OTEL metric ingestion | **$0.50 per GB** (uncompressed OTLP payload, includes 15-month storage) |
| PromQL queries (console/dashboard) | **Free** |
| PromQL queries (API/programmatic) | $0.01 per million samples scanned |
| Existing CloudWatch metrics | **Unchanged** — vended metrics remain free, existing alarms unaffected |

### Flex cost projection

A typical OTEL data point with 10-15 resource attributes is ~400 bytes uncompressed.

**Per non-prod environment:**

| Metric source | Functions/Resources | Metrics per resource | Data points/day (1-min resolution) | Daily volume | Monthly volume |
|---|---|---|---|---|---|
| Lambda (AWS/Lambda) | ~20 functions | 5 (Errors, Invocations, Throttles, Duration, ConcurrentExecutions) | 1,440 | ~57 MB | ~1.7 GB |
| API Gateway (AWS/ApiGateway) | ~40 resource+method combos | 5 (Count, 4XX, 5XX, Latency, IntegrationLatency) | 1,440 | ~115 MB | ~3.5 GB |
| **Total per environment** | | | | **~172 MB** | **~5.2 GB** |
| **Cost per environment** | | | | | **~$2.60/month** |

**Across all environments:**

| Scope | Environments | Monthly cost |
|---|---|---|
| Non-prod only (dev + staging) | 2 | ~$5.20/month |
| All environments (dev + staging + prod) | 3 | ~$7.80/month |
| All environments + CloudFront/WAF/Shield enrichment | 3 | ~$10-12/month |

**Cost of the spike itself:** Enabling on one non-prod environment costs approximately **$2-3/month**. Disabling it stops the cost immediately.

### Comparison to existing CloudWatch spend

Vended metrics (Lambda, API Gateway, CloudFront, etc.) are free in CloudWatch. The OTEL enrichment cost is **purely additive** — it does not replace any existing cost, it adds a parallel metric store. At Flex's scale, this is a rounding error on the AWS bill.

---

## What the Spike Day Should Look Like

### Pre-session (30 min)

1. Enable OTEL metric enrichment on the dev AWS account via CLI or console
2. Confirm enriched metrics appear in CloudWatch (takes a few minutes)

### Session 1: Re-graph existing widget (1-2 hours)

1. Open the driving dashboard — pick the DVLA vehicles endpoint latency + throughput widgets
2. Create a new dashboard `{env}-flex-otel-spike`
3. Add PromQL widgets recreating:
   - Request count time-series (5-min rate)
   - Success/4XX/5XX rate breakdown
   - p50/p90/p99 latency
4. Compare side-by-side with the existing dashboard — are the numbers the same? Any gaps?

### Session 2: Capabilities discovery (2-3 hours)

1. Try cross-endpoint queries — all DVLA latencies in one widget using regex
2. Try cross-domain queries — error rates across all domains
3. Try tag-based filtering — filter by team/environment tags
4. Try `topk()` — top 5 slowest endpoints, top 5 most-erroring functions
5. Try building a "platform overview" dashboard that would be painful in CloudWatch:
   - All Lambda error rates in one widget, grouped by function
   - All API Gateway latencies, grouped by endpoint
   - Top N queries for anomaly spotting

### Session 3: Document and decide (1-2 hours)

1. Write up findings against acceptance criteria
2. Capture any friction, limitations, or surprises
3. Cost analysis (confirm against actual ingestion volume in CloudWatch)
4. Recommendation

---

## Risks and Limitations

| Risk | Impact | Mitigation |
|---|---|---|
| OTEL metric names differ from CloudWatch names | PromQL queries use OTEL-style metric names (e.g., `aws_lambda_duration` not `AWS/Lambda Duration`) — need to discover the mapping | AWS documents the mapping; the spike will establish the translation |
| Custom metrics (`Flex/Credentials`, `Flex/SmokeTest`) are NOT enriched | Vended enrichment only covers AWS service metrics, not PutMetricData custom metrics | Custom metrics would need ADOT for enrichment (separate, larger effort) |
| PromQL alarm support is newer and less mature | May not support all alarm patterns (anomaly detection, composite alarms) | Keep alarms on native CloudWatch; use PromQL for dashboards and exploration only |
| Histogram quantile accuracy | OTEL histogram bucket boundaries may differ from CloudWatch's native percentile calculation | Compare p99 values side-by-side during the spike |
| Account-level setting affects all services | Cannot selectively enrich only some Lambda functions | Acceptable for non-prod; in prod, all metrics are enriched or none |

---

## Recommendation (Pre-Spike)

**Enable it. The cost is negligible, the risk is zero, and it's fully reversible.**

Unlike the tracing spike (which requires SDK integration, has ESM risks, and cold start penalties), OTEL metric enrichment is a configuration toggle with no application impact. The evaluation question is purely: **does PromQL provide enough operational value over CloudWatch Metrics to justify ~$8-12/month across all environments?**

Based on the current dashboard structure — 50+ widgets, each manually specifying exact dimension values, with no cross-resource aggregation — the answer is likely yes. The driving dashboard alone has ~30 widgets that could collapse into 5-6 PromQL queries. But the spike will confirm this with real data and real queries.

### What would a platform-wide rollout look like?

| Step | Effort | Impact |
|---|---|---|
| Enable enrichment on all accounts | 1 CLI command per account (or a CDK custom resource) | Zero downtime, zero code changes |
| Migrate existing dashboards to PromQL | 2-3 days per dashboard (driving + UDP) | Better query flexibility, more compact definitions |
| Build new "platform overview" dashboards | 1-2 days | Cross-domain visibility not currently possible |
| Migrate alarms to PromQL | **Not recommended** | Keep alarms on native CloudWatch |
| Add OTEL enrichment for custom metrics | Requires ADOT layer — separate effort, has ESM/cold-start concerns | Defer unless needed |
