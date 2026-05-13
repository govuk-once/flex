import { getEnvConfig } from "@flex/utils";
import { Distribution, Function } from "aws-cdk-lib/aws-cloudfront";
import { Construct } from "constructs";

import { BaseStack } from "../base";
import { importAlarmActions } from "../constructs/alarms/actions";
import { CloudFrontAlarms } from "../constructs/alarms/cloudfront";
import { ShieldAlarms } from "../constructs/alarms/shield";
import { ENV_KEYS, STAGE_KEYS } from "../ssm-keys";

const { stage } = getEnvConfig();

export class FlexCloudfrontAlarmsStack extends BaseStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "N/A",
        ResourceOwner: "flex-platform",
        Source: "https://github.com/govuk-once/flex",
      },
      env: {
        region: "us-east-1",
      },
    });

    const distributionId = this.import(STAGE_KEYS.CloudfrontId, "eu-west-2");

    const distribution = Distribution.fromDistributionAttributes(
      this,
      "Distribution",
      {
        distributionId,
        domainName: "placeholder", // not used by alarm metrics
      },
    );

    const viewerRequestFunction = Function.fromFunctionAttributes(
      this,
      "ViewerRequestFunction",
      {
        functionArn: this.import(STAGE_KEYS.CloudfrontFunctionArn, "eu-west-2"),
        functionName: this.import(
          STAGE_KEYS.CloudfrontFunctionName,
          "eu-west-2",
        ),
      },
    );

    const { criticalAction, warningAction } = importAlarmActions(this, {
      criticalTopicArn: this.import(ENV_KEYS.TopicCriticalAlarms, "eu-west-2"),
      warningTopicArn: this.import(ENV_KEYS.TopicWarningAlarms, "eu-west-2"),
    });

    new CloudFrontAlarms(this, "Alarms", {
      alarmNamePrefix: `${stage}-cf`,
      distribution,
      viewerRequestFunction,
      criticalAction,
      warningAction,
    });

    new ShieldAlarms(this, "ShieldAlarms", {
      alarmNamePrefix: `${stage}-shield`,
      resourceArn: `arn:aws:cloudfront::${this.account}:distribution/${distributionId}`,
      criticalAction,
      warningAction,
    });
  }
}
