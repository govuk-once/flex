import { getEnvConfig } from "@flex/utils";
import { CfnOutput, Duration } from "aws-cdk-lib";
import { RestApi } from "aws-cdk-lib/aws-apigateway";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import {
  Code,
  Function as LambdaFunction,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { Topic } from "aws-cdk-lib/aws-sns";
import { LambdaSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import { Construct } from "constructs";

import { BaseStack } from "../base";
import { importAlarmActions } from "../constructs/alarms/actions";
import { FlexCloudfront } from "../constructs/cloudfront/flex-cloudfront";
import { ENV_KEYS, PLATFORM_KEYS, STAGE_KEYS } from "../ssm-keys";

interface DomainNames {
  domainName: string;
  subdomainName?: string;
}

const { persistent, stage } = getEnvConfig();

export class FlexGlobalStack extends BaseStack {
  #buildRelay(
    severity: "Critical" | "Warning",
    targetTopicArn: string,
    alarmTopicKey: Key,
  ) {
    const relayTopic = new Topic(this, `${severity}RelayTopic`, {
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

  #createAlarmActions() {
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

    const criticalRelay = this.#buildRelay(
      "Critical",
      criticalTargetArn,
      alarmTopicKey,
    );
    const warningRelay = this.#buildRelay(
      "Warning",
      warningTargetArn,
      alarmTopicKey,
    );

    return importAlarmActions(this, {
      criticalTopicArn: criticalRelay.topicArn,
      warningTopicArn: warningRelay.topicArn,
    });
  }

  #getDomainName(): DomainNames {
    const domainName = this.import(PLATFORM_KEYS.HostedZoneName, "eu-west-2");
    const subdomainName = persistent ? undefined : `${stage}.${domainName}`;

    return { domainName, subdomainName };
  }

  #createCertificate({ domainName, subdomainName }: DomainNames) {
    const hostedZone = HostedZone.fromHostedZoneAttributes(this, "Zone", {
      hostedZoneId: this.import(PLATFORM_KEYS.HostedZoneId, "eu-west-2"),
      zoneName: this.import(PLATFORM_KEYS.HostedZoneName, "eu-west-2"),
    });

    const cert = new Certificate(this, "FlexCert", {
      domainName: subdomainName ?? domainName,
      validation: CertificateValidation.fromDns(hostedZone),
    });

    return { cert, hostedZone };
  }

  #getPublicRestApi() {
    const restApiId = this.import(STAGE_KEYS.ApigwPublicRestId, "eu-west-2");
    const rootResourceId = this.import(
      STAGE_KEYS.ApigwPublicAppRoot,
      "eu-west-2",
    );

    const restApi = RestApi.fromRestApiAttributes(this, "PublicRestApi", {
      restApiId,
      rootResourceId,
    });

    return { restApi };
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

    const { domainName, subdomainName } = this.#getDomainName();

    const { cert, hostedZone } = this.#createCertificate({
      domainName,
      subdomainName,
    });

    const { criticalAction, warningAction } = this.#createAlarmActions();

    const { restApi } = this.#getPublicRestApi();

    const secretHeaderArn = this.import(
      STAGE_KEYS.WafCfSecretHeaderArn,
      "eu-west-2",
    );

    new FlexCloudfront(this, "Cloudfront", {
      certArn: cert.certificateArn,
      secretHeaderArn,
      domainName,
      subdomainName,
      restApi,
      hostedZone,
      criticalAction,
      warningAction,
    });

    new CfnOutput(this, "FlexApiUrl", {
      value: `https://${subdomainName ?? domainName}`,
    });
  }
}
