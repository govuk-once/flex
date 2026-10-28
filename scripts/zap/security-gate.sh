
#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${GITHUB_WORKSPACE:-$(pwd)}"
REPORT="$WORKSPACE/zap-reports/report_json.json"
RULES_FILE="$WORKSPACE/.zap/rules.tsv"
COMPLETION_MARKER="$WORKSPACE/zap-reports/scan-complete.json"

echo "Evaluating ZAP security gate..."

# Require evidence that the scan completed successfully.
if [[ ! -s "$COMPLETION_MARKER" ]]; then
  echo "::error::ZAP scan completion evidence is missing."
  exit 1
fi

jq -e '
  .completed == true
  and .zap_exit_code == 0
  and (.completed_at | type == "string")
' "$COMPLETION_MARKER" >/dev/null || {
  echo "::error::ZAP scan completion evidence is invalid."
  exit 1
}

if [[ ! -s "$REPORT" ]]; then
  echo "::error::ZAP report is missing or empty."
  exit 1
fi

if [[ ! -f "$RULES_FILE" ]]; then
  echo "::error::ZAP exception rules file is missing."
  exit 1
fi

# Validate the ZAP report structure.
jq -e '
  (.site | type == "array" and length > 0)
  and all(.site[];
    (.alerts | type == "array")
    and all(.alerts[];
      ((.riskcode | tostring) | test("^[0-3]$"))
      and (
        ((.riskcode | tonumber) < 2)
        or (
          (.instances | type == "array")
          and (.instances | length > 0)
        )
      )
    )
  )
' "$REPORT" >/dev/null || {
  echo "::error::Invalid ZAP report structure or risk codes."
  exit 1
}

# Convert reviewed TSV exceptions into JSON.
RULES_JSON="$(mktemp)"
trap 'rm -f "$RULES_JSON"' EXIT

python3 - "$RULES_FILE" "$RULES_JSON" <<'PY'
import csv
import json
import sys

source, destination = sys.argv[1:]
expected = ["plugin_id", "method", "endpoint", "parameter", "reason"]
rules = []

with open(source, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f, delimiter="\t")

    if reader.fieldnames != expected:
        raise SystemExit("Invalid ZAP rules.tsv header")

    for row in reader:
        if not all(row.get(field) for field in expected):
            raise SystemExit("Invalid or incomplete ZAP exception rule")

        rules.append(row)

with open(destination, "w", encoding="utf-8") as f:
    json.dump(rules, f)
PY

# Evaluate every Medium/High finding instance.
jq -r --slurpfile rules "$RULES_JSON" '
  $rules[0] as $exceptions |

  [
    .site[].alerts[]
    | select((.riskcode | tonumber) >= 2)
    | . as $alert
    | .instances[]
    | . as $instance
    | {
        plugin_id: ($alert.pluginid | tostring),
        severity: $alert.riskdesc,
        name: $alert.name,
        method: $instance.method,
        endpoint: (
          $instance.uri
          | sub("^https?://[^/]+"; "")
          | split("?")[0]
        ),
        parameter: $instance.param
      }
    | . as $finding
    | . + {
        approved: any($exceptions[];
          .plugin_id == $finding.plugin_id
          and .method == $finding.method
          and .endpoint == $finding.endpoint
          and .parameter == $finding.parameter
        )
      }
  ]
  | .[]
  | [
      (if .approved then "APPROVED" else "BLOCKED" end),
      .severity,
      .name,
      .method,
      .endpoint,
      .parameter
    ]
  | @tsv
' "$REPORT" > "$WORKSPACE/zap-gate-results.tsv"

echo "Medium/High finding evaluation:"
cat "$WORKSPACE/zap-gate-results.tsv"

BLOCKING_COUNT="$(
  awk -F '\t' '$1 == "BLOCKED" {count++} END {print count+0}' \
    "$WORKSPACE/zap-gate-results.tsv"
)"

APPROVED_COUNT="$(
  awk -F '\t' '$1 == "APPROVED" {count++} END {print count+0}' \
    "$WORKSPACE/zap-gate-results.tsv"
)"

echo "Approved exceptions: $APPROVED_COUNT"
echo "Blocking findings: $BLOCKING_COUNT"

if [[ "$BLOCKING_COUNT" -gt 0 ]]; then
  echo "::error::ZAP security gate FAILED: $BLOCKING_COUNT unapproved Medium/High instances."
  exit 1
fi

echo "ZAP security gate PASSED."
