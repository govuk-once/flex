
#!/usr/bin/env bash
set -euo pipefail

REPORT="zap-reports/report_json.json"
NEW_FINDINGS="$RUNNER_TEMP/zap-findings-new.txt"

if [[ ! -s "$NEW_FINDINGS" ]]; then
  echo "No new ZAP findings to notify."
  exit 0
fi

if [[ ! -s "$REPORT" ]]; then
  echo "ERROR: ZAP JSON report missing."
  exit 1
fi

DETAILS="$(
  jq -r --rawfile new "$NEW_FINDINGS" '
    ($new | split("\n") | map(select(length > 0))) as $newKeys
    |
    [
      .site[].alerts[]?
      | . as $alert
      | .instances[]?
      | .uri as $uri
      | ($uri | capture("/app/(?<domain>[^/]+)/")?.domain // empty) as $domain
      | "\($alert.pluginid)|\($domain)" as $key
      | select($newKeys | index($key))
      | {
          key: $key,
          severity: $alert.riskdesc,
          name: $alert.name,
          domain: $domain
        }
    ]
    | unique_by(.key)
    | .[]
    | "• [\(.severity)] \(.name) — \(.domain)"
  ' "$REPORT"
)"

if [[ -z "$DETAILS" ]]; then
  echo "No matching notification details found."
  exit 0
fi

{
  echo "findings<<ZAP_FINDINGS_EOF"
  echo "$DETAILS"
  echo "ZAP_FINDINGS_EOF"
} >> "$GITHUB_OUTPUT"

echo "Prepared ZAP notification:"
echo "$DETAILS"
