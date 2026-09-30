import { getEnvConfig } from "@flex/utils";
import { EventField, Rule, RuleTargetInput } from "aws-cdk-lib/aws-events";
import { SnsTopic } from "aws-cdk-lib/aws-events-targets";
import type { Topic } from "aws-cdk-lib/aws-sns";
import type { Construct } from "constructs";

const { env } = getEnvConfig();

interface SecretRotationAlertsProps {
  criticalTopic: Topic;
}

export function createSecretRotationFailureAlert(
  scope: Construct,
  { criticalTopic }: SecretRotationAlertsProps,
) {
  const secretId = EventField.fromPath("$.detail.additionalEventData.SecretId");

  new Rule(scope, "SecretRotationFailedRule", {
    description: "Alert when Secrets Manager fails to rotate a secret",
    eventPattern: {
      source: ["aws.secretsmanager"],
      detailType: ["AWS Service Event via CloudTrail"],
      detail: {
        eventName: ["RotationFailed"],
      },
    },
    targets: [
      new SnsTopic(criticalTopic, {
        message: RuleTargetInput.fromObject({
          version: "1.0",
          source: "custom",
          content: {
            textType: "client-markdown",
            title: `Secret rotation failed in ${env}`,
            description: `Secrets Manager failed to rotate \`${secretId}\`. The secret keeps its current value; check the rotation Lambda logs, then follow the leaked secret runbook to rotate manually if needed.`,
          },
        }),
      }),
    ],
  });
}
