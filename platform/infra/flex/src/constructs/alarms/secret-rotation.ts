import { Rule } from "aws-cdk-lib/aws-events";
import { SnsTopic } from "aws-cdk-lib/aws-events-targets";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { ITopic } from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";

export interface SecretRotationAlarmsProps {
  readonly alarmNamePrefix: string;
  readonly secret: ISecret;
  readonly criticalTopic: ITopic;
  readonly warningTopic: ITopic;
}

export class SecretRotationAlarms extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: SecretRotationAlarmsProps,
  ) {
    super(scope, id);

    const { alarmNamePrefix, secret, criticalTopic, warningTopic } = props;

    new Rule(this, "RotationFailedRule", {
      ruleName: `${alarmNamePrefix}-rotation-failed`,
      description: `Secret rotation failed for ${secret.secretName}`,
      eventPattern: {
        source: ["aws.secretsmanager"],
        detailType: ["AWS Service Event via CloudTrail"],
        detail: {
          eventName: ["RotationFailed"],
          additionalEventData: {
            SecretId: [secret.secretArn],
          },
        },
      },
      targets: [new SnsTopic(criticalTopic)],
    });

    new Rule(this, "RotationSucceededRule", {
      ruleName: `${alarmNamePrefix}-rotation-succeeded`,
      description: `Secret rotation succeeded for ${secret.secretName} — deploy to activate`,
      eventPattern: {
        source: ["aws.secretsmanager"],
        detailType: ["AWS Service Event via CloudTrail"],
        detail: {
          eventName: ["RotationSucceeded"],
          additionalEventData: {
            SecretId: [secret.secretArn],
          },
        },
      },
      targets: [new SnsTopic(warningTopic)],
    });
  }
}
