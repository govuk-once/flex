
#!/usr/bin/env bash
set -euo pipefail

REPORT_DIR="${GITHUB_WORKSPACE:-$(pwd)}/zap-reports"

echo "Verifying ZAP reports..."

for REPORT in \
  report_json.json \
  report_md.md \
  report_html.html \
  report.sarif.json
do
  if [[ ! -s "${REPORT_DIR}/${REPORT}" ]]; then
    echo "ERROR: Missing or empty ZAP report: ${REPORT}"
    exit 1
  fi
done

jq -e '
  .site | type == "array"
' "${REPORT_DIR}/report_json.json" >/dev/null

jq -e '
  .version == "2.1.0"
  and (.runs | type == "array")
' "${REPORT_DIR}/report.sarif.json" >/dev/null

echo "ZAP JSON alerts:"
jq '[.site[].alerts[]] | length' \
  "${REPORT_DIR}/report_json.json"

echo "SARIF results:"
jq '[.runs[].results // []] | flatten | length' \
  "${REPORT_DIR}/report.sarif.json"

echo "SARIF version:"
jq -r '.version' \
  "${REPORT_DIR}/report.sarif.json"

echo "ZAP report verification successful."
