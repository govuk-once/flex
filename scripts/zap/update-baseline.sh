
#!/usr/bin/env bash
set -euo pipefail

CURRENT="$RUNNER_TEMP/zap-findings-current.txt"
BASELINE="$RUNNER_TEMP/zap-findings-baseline.txt"
OUTPUT="zap-findings-baseline.txt"

if [[ ! -f "$CURRENT" || ! -f "$BASELINE" ]]; then
  echo "ERROR: Current findings or previous baseline missing."
  exit 1
fi

cat "$BASELINE" "$CURRENT" |
  LC_ALL=C sort -u > "$OUTPUT"

echo "Updated ZAP baseline:"
cat "$OUTPUT"

echo "Baseline contains $(wc -l < "$OUTPUT" | tr -d ' ') unique fingerprints."
