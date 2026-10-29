
#!/usr/bin/env bash
set -euo pipefail

BASELINE="$RUNNER_TEMP/zap-findings-baseline.txt"
ARTIFACT_NAME="${ZAP_BASELINE_ARTIFACT:-zap-api-staging-baseline}"

touch "$BASELINE"

ARTIFACT_ID="$(
  gh api \
    "/repos/${GITHUB_REPOSITORY}/actions/artifacts?name=${ARTIFACT_NAME}&per_page=100" \
    --jq '
      [
        .artifacts[]
        | select(.expired == false)
      ]
      | sort_by(.created_at)
      | reverse
      | .[0].id // ""
    '
)"

if [[ -z "$ARTIFACT_ID" ]]; then
  echo "No previous ZAP baseline found."
  echo "This run will seed the initial baseline."
  echo "found=false" >> "$GITHUB_OUTPUT"
  exit 0
fi

echo "Found previous baseline artifact: $ARTIFACT_ID"

mkdir -p "$RUNNER_TEMP/zap-baseline-download"

gh api \
  "/repos/${GITHUB_REPOSITORY}/actions/artifacts/${ARTIFACT_ID}/zip" \
  > "$RUNNER_TEMP/zap-baseline.zip"

unzip -q \
  "$RUNNER_TEMP/zap-baseline.zip" \
  -d "$RUNNER_TEMP/zap-baseline-download"

cp \
  "$RUNNER_TEMP/zap-baseline-download/zap-findings-baseline.txt" \
  "$BASELINE"

LC_ALL=C sort -u "$BASELINE" -o "$BASELINE"

echo "Previous ZAP finding baseline:"
cat "$BASELINE"

echo "found=true" >> "$GITHUB_OUTPUT"
