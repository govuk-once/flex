
#!/usr/bin/env bash
set -euo pipefail

OPENAPI_FILE="dist/openapi/merged-openapi.json"

if [[ -z "${API_URL:-}" ]]; then
  echo "STAGING_API_URL is not configured"
  exit 1
fi

if [[ -z "${ZAP_AUTH_HEADER_VALUE:-}" ]]; then
  echo "ZAP authentication header is missing"
  exit 1
fi

if [[ ! -s "$OPENAPI_FILE" ]]; then
  echo "OpenAPI specification is missing or empty: $OPENAPI_FILE"
  exit 1
fi

mapfile -t ENDPOINTS < <(
  jq -r '
    .paths
    | to_entries[]
    | select(.key | contains("{") | not)
    | select(
        .value.get != null
        and (
          [.value.get.parameters[]? | select(.required == true)]
          | length
        ) == 0
      )
    | .key
  ' "$OPENAPI_FILE"
)

if [[ "${#ENDPOINTS[@]}" -eq 0 ]]; then
  echo "No suitable GET endpoints found for authentication testing"
  exit 1
fi

AUTHENTICATED=false

for ENDPOINT in "${ENDPOINTS[@]}"; do
  STATUS=$(curl --silent --show-error \
    --output /dev/null \
    --write-out '%{http_code}' \
    --connect-timeout 10 \
    --max-time 30 \
    --header "Authorization: ${ZAP_AUTH_HEADER_VALUE}" \
    "${API_URL%/}${ENDPOINT}") || STATUS="000"

  echo "GET ${ENDPOINT}: HTTP ${STATUS}"

  if [[ "$STATUS" == "200" ]]; then
    AUTHENTICATED=true
    break
  fi
done

if [[ "$AUTHENTICATED" != "true" ]]; then
  echo "Authentication verification failed: no endpoint returned HTTP 200"
  exit 1
fi

echo "Authentication verification successful"
