#!/usr/bin/env bash

set -e

RUN_STAGES=("development" "staging" "production")

for stage in "${RUN_STAGES[@]}"; do
  if [[ "$STAGE" == "$stage" ]]; then
    "$@"
    exit 0
  fi
done

echo "STAGE='$STAGE' does not match allowed stages. Skipping..."
exit 0
