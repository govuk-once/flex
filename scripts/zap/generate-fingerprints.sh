
#!/usr/bin/env bash
set -euo pipefail

OUTPUT="$RUNNER_TEMP/zap-findings-current.txt"

jq -r '
  .runs[].results[]?
  | . as $result
  | ($result.ruleId // "unknown") as $rule
  | $result.locations[]?
  | .physicalLocation.artifactLocation.uri
  | sub("^https?://[^/]+/?"; "")
  | split("/")
  | select(length >= 2)
  | "\($rule)|\(.[1])"
' report.github.sarif.json \
  | LC_ALL=C sort -u > "$OUTPUT"

echo "Current ZAP finding fingerprints:"
cat "$OUTPUT"

COUNT="$(wc -l < "$OUTPUT" | tr -d ' ')"
echo "Unique ZAP finding fingerprint count: $COUNT"

echo "count=$COUNT" >> "$GITHUB_OUTPUT"
