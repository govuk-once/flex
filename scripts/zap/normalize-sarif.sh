
#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${GITHUB_WORKSPACE:-$(pwd)}"
REPORT_DIR="$WORKSPACE/zap-reports"
OUTPUT="$WORKSPACE/report.github.sarif.json"

jq --slurpfile zap "$REPORT_DIR/report_json.json" '
  ($zap[0].site
    | map(.alerts // [])
    | flatten
    | map({
        key: (.pluginid | tostring),
        value: (.riskcode | tonumber)
      })
    | from_entries
  ) as $risk |

  walk(
    if type == "object"
      and has("artifactLocation")
      and (.artifactLocation.uri? | type == "string")
      and (.artifactLocation.uri | test("^https?://"))
    then
      .artifactLocation.uri |= sub("^https?://[^/]+/?"; "")
    else
      .
    end
  )
  |
  .runs |= map(
    .tool.driver.rules |= map(
      .properties = (.properties // {}) |
      .properties.tags = (
        (.properties.tags // []) + ["security"] | unique
      ) |
      if $risk[.id] == 3 then
        .properties."security-severity" = "8.0"
      elif $risk[.id] == 2 then
        .properties."security-severity" = "5.0"
      elif $risk[.id] == 1 then
        .properties."security-severity" = "2.0"
      elif $risk[.id] == 0 then
        .properties."security-severity" = "0.0"
      else
        .
      end
    )
  )
' "$REPORT_DIR/report.sarif.json" > "$OUTPUT"

echo "Normalized SARIF locations:"
jq -r '
  .runs[].results[]?.locations[]?
  | .physicalLocation.artifactLocation.uri
' "$OUTPUT" | sort -u

echo "GitHub security severity mapping:"
jq -r '
  .runs[].tool.driver.rules[]?
  | [
      .id,
      .name,
      (.properties."security-severity" // "not-set"),
      ((.properties.tags // []) | join(","))
    ]
  | @tsv
' "$OUTPUT"

echo "SARIF normalization complete."
