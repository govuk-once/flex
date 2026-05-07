#!/usr/bin/env bash
# Aggregate per-import timings emitted by the perf-domain
# `profile-imports` handler. Run after `pnpm cold-starts` so the
# CloudWatch logs are populated.
#
# Usage:
#   STAGE=pr-257 ./scripts/import-profile.sh
#
# Defaults to the STAGE env var; falls back to USER if unset.
set -euo pipefail

STAGE=${STAGE:-${USER:?STAGE not set and USER is empty}}
REGION=${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-west-2}}

# Look up by listing all perf log groups for the stage and filtering by
# substring — robust to whatever CDK suffix gets appended.
LOG_GROUP=$(aws logs describe-log-groups \
  --region "$REGION" \
  --log-group-name-prefix "/aws/lambda/${STAGE}-perf-" \
  --query "logGroups[?contains(logGroupName, 'ProfileImports')].logGroupName | [0]" \
  --output text)

if [ "$LOG_GROUP" = "None" ] || [ -z "$LOG_GROUP" ]; then
  echo "no profile-imports log group for stage $STAGE in region $REGION" >&2
  echo "perf log groups found:" >&2
  aws logs describe-log-groups \
    --region "$REGION" \
    --log-group-name-prefix "/aws/lambda/${STAGE}-perf-" \
    --query 'logGroups[*].logGroupName' --output text >&2 || true
  exit 1
fi
echo "log group: $LOG_GROUP"

QUERY_ID=$(aws logs start-query \
  --region "$REGION" \
  --log-group-name "$LOG_GROUP" \
  --start-time "$(($(date +%s) - 7200))" \
  --end-time "$(date +%s)" \
  --query-string 'fields @timestamp, @message | filter @message like /import-profile/ | limit 100' \
  --query queryId --output text)

echo "query: $QUERY_ID — polling…"
until [ "$(aws logs get-query-results --region "$REGION" --query-id "$QUERY_ID" --query status --output text)" = "Complete" ]; do
  sleep 1
done

aws logs get-query-results --region "$REGION" --query-id "$QUERY_ID" --output json | python3 -c '
import sys, json
data = json.load(sys.stdin)
samples = []
for row in data["results"]:
    msg = next((c["value"] for c in row if c["field"] == "@message"), None)
    if not msg:
        continue
    try:
        payload = json.loads(msg)
    except Exception:
        continue
    if payload.get("message") == "import-profile":
        samples.append(payload["stages"])

if not samples:
    print("no import-profile samples found", file=sys.stderr)
    sys.exit(1)

print(f"\nsamples: {len(samples)}\n")
keys = sorted({k for s in samples for k in s})
print(f"{\"stage\":<30} {\"min\":>9} {\"p50\":>9} {\"mean\":>9} {\"max\":>9}")
print("-" * 70)
for k in keys:
    vals = sorted(s[k] for s in samples if k in s)
    n = len(vals)
    p50 = vals[n // 2]
    avg = sum(vals) / n
    print(f"{k:<30} {vals[0]:>7.1f}ms {p50:>7.1f}ms {avg:>7.1f}ms {vals[-1]:>7.1f}ms")
'
