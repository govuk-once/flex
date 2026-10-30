
#!/usr/bin/env bash
set -euo pipefail

CURRENT="$RUNNER_TEMP/zap-findings-current.txt"
BASELINE="$RUNNER_TEMP/zap-findings-baseline.txt"
NEW="$RUNNER_TEMP/zap-findings-new.txt"

LC_ALL=C sort -u "$CURRENT" -o "$CURRENT"
LC_ALL=C sort -u "$BASELINE" -o "$BASELINE"

if [[ "${BASELINE_FOUND:-}" == "false" ]]; then
  : > "$NEW"
  echo "Initial baseline run - existing findings will not trigger a notification."
else
  comm -13 "$BASELINE" "$CURRENT" > "$NEW"
fi

NEW_COUNT="$(wc -l < "$NEW" | tr -d ' ')"

echo "New ZAP finding count: $NEW_COUNT"

if [[ "$NEW_COUNT" -gt 0 ]]; then
  echo "New ZAP findings:"
  cat "$NEW"
else
  echo "No new ZAP findings detected."
fi

echo "count=$NEW_COUNT" >> "$GITHUB_OUTPUT"
