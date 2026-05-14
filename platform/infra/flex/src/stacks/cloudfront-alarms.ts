import { getEnvConfig } from "@flex/utils";
import { Duration } from "aws-cdk-lib";
import {
  Distribution,
  Function as CloudfrontFunction,
} from "aws-cdk-lib/aws-cloudfront";
import { PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import {
  Code,
  Function as LambdaFunction,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
import { Topic } from "aws-cdk-lib/aws-sns";
import { LambdaSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import { Construct } from "constructs";

import { BaseStack } from "../base";
import { importAlarmActions } from "../constructs/alarms/actions";
import { CloudFrontAlarms } from "../constructs/alarms/cloudfront";
import { ENV_KEYS, STAGE_KEYS } from "../ssm-keys";

const { stage } = getEnvConfig();

export class FlexCloudfrontAlarmsStack extends BaseStack {
  private buildRelay(
    severity: "Critical" | "Warning",
    targetTopicArn: string,
    alarmTopicKey: Key,
  ) {
    const relayTopic = new Topic(this, `${severity}RelayTopic`, {
      topicName: `${stage}-cf-${severity.toLowerCase()}-relay`,
      masterKey: alarmTopicKey,
    });

    const relayFn = new LambdaFunction(this, `${severity}RelayFn`, {
      runtime: Runtime.NODEJS_24_X,
      handler: "index.handler",
      timeout: Duration.seconds(10),
      code: Code.fromInline(`
        const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
        const client = new SNSClient({ region: "eu-west-2" });
        exports.handler = async (event) => {
          for (const record of event.Records ?? []) {
            await client.send(new PublishCommand({
              TopicArn: ${targetTopicArn},
              Subject: record.Sns.Subject?.slice(0, 100),
              Message: record.Sns.Message,
              MessageAttributes: record.Sns.MessageAttributes,
            }));
          }
        };
      `),
    });

    relayFn.addToRolePolicy(
      new PolicyStatement({
        actions: ["sns:Publish"],
        resources: [targetTopicArn],
      }),
    );

    relayTopic.addSubscription(new LambdaSubscription(relayFn));

    return relayTopic;
  }

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

    const distribution = Distribution.fromDistributionAttributes(
      this,
      "Distribution",
      {
        distributionId: this.import(STAGE_KEYS.CloudfrontId, "eu-west-2"),
        domainName: "placeholder", // not used by alarm metrics
      },
    );

    const viewerRequestFunction = CloudfrontFunction.fromFunctionAttributes(
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

    const criticalTargetArn = this.import(
      ENV_KEYS.TopicCriticalAlarms,
      "eu-west-2",
    );
    const warningTargetArn = this.import(
      ENV_KEYS.TopicWarningAlarms,
      "eu-west-2",
    );

    const alarmTopicKey = new Key(this, "AlarmTopicRelayKey", {
      alias: `alias/${stage}-flex-alerts-relay-key`,
      description: "KMS key for alarm SNS topics",
      enableKeyRotation: true,
    });
    alarmTopicKey.grantEncryptDecrypt(
      new ServicePrincipal("cloudwatch.amazonaws.com"),
    );

    const criticalRelay = this.buildRelay(
      "Critical",
      criticalTargetArn,
      alarmTopicKey,
    );
    const warningRelay = this.buildRelay(
      "Warning",
      warningTargetArn,
      alarmTopicKey,
    );

    const { criticalAction, warningAction } = importAlarmActions(this, {
      criticalTopicArn: criticalRelay.topicArn,
      warningTopicArn: warningRelay.topicArn,
    });

    new CloudFrontAlarms(this, "Alarms", {
      alarmNamePrefix: `${stage}-cf`,
      distribution,
      viewerRequestFunction,
      criticalAction,
      warningAction,
    });
  }
}
