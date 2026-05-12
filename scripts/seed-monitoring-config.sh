#!/usr/bin/env bash
#
# Seeds the SSM parameter that drives FLEX alert Slack routing for the
# AWS account in the current AWS profile. Idempotent — safe to re-run.
#
# Usage:
#   AWS_PROFILE=flex-dev     ./scripts/seed-monitoring-config.sh development
#   AWS_PROFILE=flex-staging ./scripts/seed-monitoring-config.sh staging
#   AWS_PROFILE=flex-prod    ./scripts/seed-monitoring-config.sh production
#
# Prerequisites:
#   - awscli v2 and jq on PATH
#   - AWS_PROFILE pointing at the FLEX account for the chosen env
#   - The Slack workspace must already be authorised in AWS Chatbot for this
#     account (one-time, console-only — see instructions printed by this
#     script if missing).
#
# What it does:
#   1. Looks up the Slack workspace ID from AWS Chatbot.
#   2. Picks the correct channel IDs for the env from the table below.
#   3. Writes /{env}/flex-param/flex/monitoring to every region listed in
#      MONITORED_REGIONS. Same JSON in every region — the SSM lookup happens
#      per stack instance, one per region.
#
# To add a region: append it to MONITORED_REGIONS in this script AND in
# platform/infra/flex/src/monitored-regions.ts.
#
# To add severity channels (prod): fill SLACK_CHANNEL_PROD_CRITICAL and
# SLACK_CHANNEL_PROD_WARNING below once they exist in Slack.

set -euo pipefail

MONITORED_REGIONS=("eu-west-2" "us-east-1")

# Public Slack channel IDs — not secrets. Sourced from the AC.
declare -A SLACK_CHANNEL=(
  ["development"]="C0B1QKU3XR8"   # #govuk-once-flex-alerting-dev
  ["staging"]="C0B1M90S38D"       # #govuk-once-flex-alerting-staging
  ["production"]="C0B1J9S756X"    # #govuk-once-flex-alerting-production
)

# Prod severity channels — leave empty until the channels exist in Slack.
# Filling these in is what enables the #flex-alerts-prod-{critical,warning}
# routing on next deploy.
SLACK_CHANNEL_PROD_CRITICAL=""
SLACK_CHANNEL_PROD_WARNING=""

# AWS Chatbot stores Slack workspace authorisations as a us-east-1 resource
# regardless of where you query from.
CHATBOT_REGION="us-east-1"

ENV="${1:-}"
if [[ -z "$ENV" ]]; then
  echo "usage: $0 <development|staging|production>" >&2
  exit 64
fi

CHANNEL="${SLACK_CHANNEL[$ENV]:-}"
if [[ -z "$CHANNEL" ]]; then
  echo "error: no Slack channel mapping for env '$ENV'" >&2
  exit 64
fi

for cmd in aws jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: '$cmd' not found on PATH" >&2
    exit 69
  fi
done

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
echo "Account: $ACCOUNT_ID  env: $ENV  regions: ${MONITORED_REGIONS[*]}"

WORKSPACE_ID="$(
  aws chatbot describe-slack-workspaces \
    --region "$CHATBOT_REGION" \
    --query 'SlackWorkspaces[0].SlackTeamId' \
    --output text 2>/dev/null || true
)"

if [[ -z "$WORKSPACE_ID" || "$WORKSPACE_ID" == "None" ]]; then
  cat <<EOF >&2
error: No Slack workspace authorised in AWS Chatbot for this account.

One-time setup (browser, ~2 minutes):
  1. Open https://${CHATBOT_REGION}.console.aws.amazon.com/chatbot/home
     while signed into account ${ACCOUNT_ID}.
  2. 'Configure a chat client' -> Slack -> 'Configure'.
  3. Slack opens; sign in to the GDS workspace and click 'Allow'.
  4. Re-run this script.
EOF
  exit 1
fi

echo "Slack workspace: $WORKSPACE_ID"

PAYLOAD="$(
  jq -cn \
    --arg ws "$WORKSPACE_ID" \
    --arg ch "$CHANNEL" \
    --arg cc "$SLACK_CHANNEL_PROD_CRITICAL" \
    --arg cw "$SLACK_CHANNEL_PROD_WARNING" \
    --arg env "$ENV" '
      {workspaceId: $ws, channelId: $ch}
      + (if $env == "production" and $cc != "" then {channelIdCritical: $cc} else {} end)
      + (if $env == "production" and $cw != "" then {channelIdWarning: $cw} else {} end)
    '
)"

PARAM_NAME="/${ENV}/flex-param/flex/monitoring"

for REGION in "${MONITORED_REGIONS[@]}"; do
  echo "Writing $PARAM_NAME in $REGION"
  aws ssm put-parameter \
    --region "$REGION" \
    --name "$PARAM_NAME" \
    --type String \
    --value "$PAYLOAD" \
    --overwrite \
    --tier Standard >/dev/null
done

echo "Done."
echo "Payload: $PAYLOAD"
