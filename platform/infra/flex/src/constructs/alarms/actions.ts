import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { Topic } from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";

import { AlarmActionProps } from "./types";

interface ActionsProps {
  criticalTopicArn: string;
  warningTopicArn: string;
}

export function importAlarmActions(
  scope: Construct,
  { criticalTopicArn, warningTopicArn }: ActionsProps,
): AlarmActionProps {
  const criticalTopic = Topic.fromTopicArn(
    scope,
    "CriticalTopic",
    criticalTopicArn,
  );
  const warningTopic = Topic.fromTopicArn(
    scope,
    "WarningTopic",
    warningTopicArn,
  );

  return {
    criticalAction: new SnsAction(criticalTopic),
    warningAction: new SnsAction(warningTopic),
  };
}
