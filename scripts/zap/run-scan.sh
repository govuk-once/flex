
#!/usr/bin/env bash
set -euo pipefail

ZAP_IMAGE="ghcr.io/zaproxy/zaproxy:2.17.0@sha256:781a2bdaea47324e7bab583e2263f21d257b0aee61ed51521a5be45f5f5081ef"

WORKSPACE="${GITHUB_WORKSPACE:-$(pwd)}"
REPORT_DIR="${WORKSPACE}/zap-reports"
PLAN_TEMPLATE="${WORKSPACE}/scripts/zap/zap-plan.yaml"
PLAN_FILE="${WORKSPACE}/zap-plan.yaml"

if [[ -z "${API_URL:-}" ]]; then
  echo "ERROR: API_URL is not configured"
  exit 1
fi

if [[ -z "${ZAP_AUTH_HEADER_VALUE:-}" ]]; then
  echo "ERROR: ZAP authentication header is missing"
  exit 1
fi

if [[ ! -s "${WORKSPACE}/dist/openapi/merged-openapi.json" ]]; then
  echo "ERROR: Merged OpenAPI specification is missing"
  exit 1
fi

if [[ ! -s "$PLAN_TEMPLATE" ]]; then
  echo "ERROR: ZAP automation plan template is missing"
  exit 1
fi

mkdir -p "$REPORT_DIR"

# Clear previous reports to avoid validating stale scan results.
rm -f \
  "$REPORT_DIR/report_json.json" \
  "$REPORT_DIR/report_html.html" \
  "$REPORT_DIR/report_md.md" \
  "$REPORT_DIR/report.sarif.json"

# Substitute the staging API URL without interpreting it as shell code.
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

if [[ "$ZAP_EXIT_CODE" -ne 0 ]]; then
  echo "ZAP returned exit code $ZAP_EXIT_CODE"
fi

# Preserve existing workflow behaviour.
# Exit code 1 is currently tolerated; report validation and
# the new security gate will enforce the release requirements.
if [[ "$ZAP_EXIT_CODE" -gt 1 ]]; then
  echo "ZAP execution failed (exit code $ZAP_EXIT_CODE)"
  exit "$ZAP_EXIT_CODE"
fi

exit 0
