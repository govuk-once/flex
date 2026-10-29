
#!/usr/bin/env bash
set -euo pipefail

ZAP_IMAGE="ghcr.io/zaproxy/zaproxy:2.17.0@sha256:781a2bdaea47324e7bab583e2263f21d257b0aee61ed51521a5be45f5f5081ef"

WORKSPACE="${GITHUB_WORKSPACE:-$(pwd)}"
REPORT_DIR="${WORKSPACE}/zap-reports"
COMPLETION_MARKER="${REPORT_DIR}/scan-complete.json"
PLAN_TEMPLATE="${WORKSPACE}/scripts/zap/zap-plan.yaml"
PLAN_FILE="${WORKSPACE}/zap-plan.yaml"

if [[ -z "${API_URL:-}" ]]; then
  echo "::error::API_URL is not configured"
  exit 1
fi

if [[ -z "${ZAP_AUTH_HEADER_VALUE:-}" ]]; then
  echo "::error::ZAP authentication header is missing"
  exit 1
fi

if [[ ! -s "${WORKSPACE}/dist/openapi/merged-openapi.json" ]]; then
  echo "::error::Merged OpenAPI specification is missing"
  exit 1
fi

if [[ ! -s "$PLAN_TEMPLATE" ]]; then
  echo "::error::ZAP automation plan template is missing"
  exit 1
fi

mkdir -p "$REPORT_DIR"

# Remove previous scan completion evidence and reports.
rm -f \
  "$COMPLETION_MARKER" \
  "$REPORT_DIR/report_json.json" \
  "$REPORT_DIR/report_html.html" \
  "$REPORT_DIR/report_md.md" \
  "$REPORT_DIR/report.sarif.json"

# Generate the ZAP automation plan.
export API_URL

python3 - "$PLAN_TEMPLATE" "$PLAN_FILE" <<'PY'
import os
import pathlib
import sys

template = pathlib.Path(sys.argv[1]).read_text()
api_url = os.environ["API_URL"]

if "${API_URL}" not in template:
    raise SystemExit("ERROR: API_URL placeholder missing from ZAP plan")

pathlib.Path(sys.argv[2]).write_text(
    template.replace("${API_URL}", api_url)
)
PY

ZAP_UID="$(docker run --rm "$ZAP_IMAGE" id -u)"

echo "ZAP container UID: $ZAP_UID"
sudo chown "$ZAP_UID" "$REPORT_DIR"

echo "Starting authenticated ZAP API scan"

set +e

docker run --rm \
  --network=host \
  -v "${WORKSPACE}:/zap/wrk/:ro" \
  -v "${REPORT_DIR}:/zap/reports:rw" \
  -e ZAP_AUTH_HEADER_VALUE \
  -e ZAP_AUTH_HEADER="Authorization" \
  "$ZAP_IMAGE" \
  zap.sh \
    -cmd \
    -autorun /zap/wrk/zap-plan.yaml

ZAP_EXIT_CODE=$?

set -e

echo "ZAP exit code: $ZAP_EXIT_CODE"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "zap_exit_code=$ZAP_EXIT_CODE" >> "$GITHUB_OUTPUT"
fi

echo "Report directory contents:"
ls -lah "$REPORT_DIR"

# Fail closed on any non-zero execution result.
if [[ "$ZAP_EXIT_CODE" -ne 0 ]]; then
  echo "::error::ZAP execution failed or returned a non-zero result (code $ZAP_EXIT_CODE)"
  exit 1
fi

# Verify that all expected reports were generated.
for report in \
  report_json.json \
  report_html.html \
  report_md.md \
  report.sarif.json
do
  if [[ ! -s "$REPORT_DIR/$report" ]]; then
    echo "::error::Missing or empty ZAP report: $report"
    exit 1
  fi
done

# Validate JSON and SARIF report structures.
jq -e '
  (.site | type == "array")
  and (.site | length > 0)
' "$REPORT_DIR/report_json.json" >/dev/null || {
  echo "::error::ZAP JSON report is invalid."
  exit 1
}

jq -e '
  (.runs | type == "array")
  and (.runs | length > 0)
' "$REPORT_DIR/report.sarif.json" >/dev/null || {
  echo "::error::ZAP SARIF report is invalid."
  exit 1
}

sudo chown -R "$(id -u):$(id -g)" "$REPORT_DIR"

# Record successful execution only after report validation.
python3 - "$COMPLETION_MARKER" "$ZAP_EXIT_CODE" <<'PY'
import json
import pathlib
import sys
from datetime import datetime, timezone

path = pathlib.Path(sys.argv[1])
exit_code = int(sys.argv[2])

path.write_text(json.dumps({
    "completed": True,
    "zap_exit_code": exit_code,
    "completed_at": datetime.now(timezone.utc).isoformat()
}, indent=2))
PY

echo "ZAP scan completed successfully."
