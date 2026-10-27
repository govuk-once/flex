
#!/usr/bin/env bash
set -euo pipefail

REPORT="${GITHUB_WORKSPACE:-$(pwd)}/zap-reports/report_json.json"

echo "Evaluating ZAP security gate..."

if [[ ! -s "$REPORT" ]]; then
  echo "::error::ZAP report is missing or empty."
  exit 1
fi

# ZAP risk codes:
# 0 = Informational
# 1 = Low
# 2 = Medium
# 3 = High

jq -e '
  (.site | type == "array") and
  (.site | length > 0) and
  all(.site[];
    (.alerts | type == "array") and
    all(.alerts[];
      (.riskcode | tostring | test("^[0-3]$"))
    )
  )
' "$REPORT" >/dev/null || {
  echo "::error::ZAP report structure or risk codes are invalid."
  exit 1
}

echo "Finding counts by severity:"

jq -r '
  [.site[].alerts[]] |
  group_by(.riskcode | tonumber) |
  .[] |
  "\(.[0].riskcode): \(length)"
' "$REPORT"

BLOCKING_COUNT="$(
  jq '
    [
      .site[].alerts[]
      | select((.riskcode | tonumber) >= 2)
    ]
    | length
  ' "$REPORT"
)"

echo "Medium/High findings: $BLOCKING_COUNT"

if [[ "$BLOCKING_COUNT" -gt 0 ]]; then
  echo "::error::ZAP security gate FAILED: $BLOCKING_COUNT Medium/High findings."
  exit 1
fi

echo "ZAP security gate PASSED: No Medium/High findings."
