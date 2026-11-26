import { mkdirSync } from "node:fs";

import { findProjectRoot } from "@flex/utils";
import { Match, Template } from "aws-cdk-lib/assertions";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { loadInfra, TEST_ACCOUNT } from "../__tests__/load-infra";

const SPECS_FOLDER = `${findProjectRoot()}/dist/openapi/current`;

async function createGlobalStack() {
  const { SsmApp, ENV_KEYS, PLATFORM_KEYS, STAGE_KEYS } =
    await loadInfra("staging");
  const { FlexGlobalStack } = await import("./global");

  const app = new SsmApp();
  app.addExternalExports("eu-west-2", [
    ENV_KEYS.TopicCriticalAlarms,
    ENV_KEYS.TopicWarningAlarms,
    ENV_KEYS.AlarmTopicKeyArn,
    PLATFORM_KEYS.HostedZoneId,
    PLATFORM_KEYS.HostedZoneName,
    STAGE_KEYS.ApigwPublicRestId,
    STAGE_KEYS.ApigwPublicAppRoot,
    STAGE_KEYS.WafCfSecretHeaderArn,
  ]);

  return new FlexGlobalStack(app, "staging-FlexGlobal");
}

describe("FlexGlobalStack certificate alarm", () => {
  let template: Template;

  beforeAll(async () => {
    template = Template.fromStack(await createGlobalStack());
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("creates no Slack channel configuration of its own, since Amazon Q allows one per channel per account", () => {
    template.resourceCountIs("AWS::Chatbot::SlackChannelConfiguration", 0);
    template.hasResourceProperties("AWS::SNS::Topic", {
      TopicName: "staging-flex-alerts-relay-health",
    });
  });

  it("pages when traffic at the edge falls below its learned baseline", () => {
    const criticalRelayId = Object.keys(
      template.findResources("AWS::SNS::Topic"),
    ).find((id) => id.startsWith("CriticalRelayTopic"));

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-cloudfront-traffic-cliff",
      ComparisonOperator: "LessThanLowerThreshold",
      EvaluationPeriods: 3,
      DatapointsToAlarm: 3,
      TreatMissingData: "breaching",
      ThresholdMetricId: Match.anyValue(),
      Metrics: Match.arrayWith([
        Match.objectLike({
          MetricStat: Match.objectLike({
            Metric: Match.objectLike({ MetricName: "Requests" }),
          }),
        }),
      ]),
      AlarmActions: [{ Ref: criticalRelayId }],
    });
  });

  it("warns through the relay when log ingestion in us-east-1 is excessive", () => {
    const warningRelayId = Object.keys(
      template.findResources("AWS::SNS::Topic"),
    ).find((id) => id.startsWith("WarningRelayTopic"));

    expect(warningRelayId).toBeDefined();

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-log-volume-incoming-bytes",
      Namespace: "AWS/Logs",
      MetricName: "IncomingBytes",
      AlarmActions: [{ Ref: warningRelayId }],
    });
  });

  it("creates a well-known S3 bucket for the CloudFront distribution", () => {
    template.hasResourceProperties("AWS::S3::Bucket", {
      BucketName: "flex-staging-well-known",
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it("alarms on the CloudFront certificate through the critical relay", () => {
    const certificateId = Object.keys(
      template.findResources("AWS::CertificateManager::Certificate"),
    )[0];
    const criticalRelayId = Object.keys(
      template.findResources("AWS::SNS::Topic"),
    ).find((id) => id.startsWith("CriticalRelayTopic"));

    expect(certificateId).toBeDefined();
    expect(criticalRelayId).toBeDefined();

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-certificate-days-to-expiry",
      MetricName: "DaysToExpiry",
      Dimensions: [{ Name: "CertificateArn", Value: { Ref: certificateId } }],
      Threshold: 30,
      AlarmActions: [{ Ref: criticalRelayId }],
    });
  });

  it("logs blocked and counted CloudFront WAF requests to S3 with secret bearing headers redacted", () => {
    const webAclId = Object.keys(
      template.findResources("AWS::WAFv2::WebACL"),
    )[0];
    const logBucketId = Object.keys(
      template.findResources("AWS::S3::Bucket", {
        Properties: { BucketName: "aws-waf-logs-flex-staging-cloudfront" },
      }),
    )[0];

    expect(webAclId).toBeDefined();
    expect(logBucketId).toBeDefined();

    template.resourceCountIs("AWS::WAFv2::LoggingConfiguration", 1);
    template.hasResourceProperties("AWS::WAFv2::LoggingConfiguration", {
      ResourceArn: { "Fn::GetAtt": [webAclId, "Arn"] },
      LogDestinationConfigs: [{ "Fn::GetAtt": [logBucketId, "Arn"] }],
      RedactedFields: [
        { SingleHeader: { Name: "authorization" } },
        { SingleHeader: { Name: "cookie" } },
        { SingleHeader: { Name: "x-origin-verify" } },
        { SingleHeader: { Name: "x-flex-e2e-bypass" } },
        { SingleHeader: { Name: "x-linking-token" } },
      ],
      LoggingFilter: {
        DefaultBehavior: "DROP",
        Filters: [
          {
            Behavior: "KEEP",
            Requirement: "MEETS_ANY",
            Conditions: [
              { ActionCondition: { Action: "BLOCK" } },
              { ActionCondition: { Action: "COUNT" } },
            ],
          },
        ],
      },
    });
  });

  it("keeps CloudFront WAF logs for 90 days under a governance lock and only accepts them from log delivery in us-east-1", () => {
    template.hasResourceProperties("AWS::S3::Bucket", {
      BucketName: "aws-waf-logs-flex-staging-cloudfront",
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          { ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } },
        ],
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      ObjectLockEnabled: true,
      ObjectLockConfiguration: {
        Rule: { DefaultRetention: { Mode: "GOVERNANCE", Days: 90 } },
      },
      LifecycleConfiguration: {
        Rules: [
          Match.objectLike({
            ExpirationInDays: 90,
            NoncurrentVersionExpiration: { NoncurrentDays: 90 },
            Status: "Enabled",
          }),
        ],
      },
    });

    const logDeliverySource = {
      "aws:SourceArn": {
        "Fn::Join": [
          "",
          [
            "arn:",
            { Ref: "AWS::Partition" },
            `:logs:us-east-1:${TEST_ACCOUNT}:*`,
          ],
        ],
      },
    };

    template.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: "AWSLogDeliveryWrite",
            Effect: "Allow",
            Principal: { Service: "delivery.logs.amazonaws.com" },
            Action: "s3:PutObject",
            Condition: {
              StringEquals: {
                "aws:SourceAccount": TEST_ACCOUNT,
                "s3:x-amz-acl": "bucket-owner-full-control",
              },
              ArnLike: logDeliverySource,
            },
          }),
          Match.objectLike({
            Sid: "AWSLogDeliveryAclCheck",
            Effect: "Allow",
            Principal: { Service: "delivery.logs.amazonaws.com" },
            Action: "s3:GetBucketAcl",
            Condition: {
              StringEquals: { "aws:SourceAccount": TEST_ACCOUNT },
              ArnLike: logDeliverySource,
            },
          }),
        ]),
      },
    });
  });

  it("names the Shield alarms -v2 under their pinned logical IDs, so the deleted originals are replaced rather than updated", () => {
    const alarms = template.findResources("AWS::CloudWatch::Alarm");

    expect(
      alarms.CloudfrontShieldAlarmsDDoSDetected3029FCB9?.Properties,
    ).toMatchObject({ AlarmName: "staging-shield-ddos-detected-v2" });
    expect(
      alarms.CloudfrontShieldAlarmsDDoSAttackRequestsPerSecond3D89A18F // pragma: allowlist secret
        ?.Properties,
    ).toMatchObject({
      AlarmName: "staging-shield-ddos-attack-requests-per-second-v2",
    });
  });
});

describe("FlexGlobalStack docs deployment", () => {
  afterAll(() => {
    vi.doUnmock("../utils/openapi-specs");
    vi.unstubAllEnvs();
  });

  it("expires old versions of everything published under docs/, where pruned specs are left", async () => {
    const template = Template.fromStack(await createGlobalStack());

    template.hasResourceProperties("AWS::S3::Bucket", {
      BucketName: "flex-staging-openapi-specs",
      LifecycleConfiguration: {
        Rules: Match.arrayWith([
          Match.objectLike({
            Prefix: "docs/",
            NoncurrentVersionExpiration: { NoncurrentDays: 30 },
          }),
        ]),
      },
    });
  });

  it("prunes docs/ when the specs are generated, so removed specs are deleted", async () => {
    vi.doMock("../utils/openapi-specs", () => ({
      hasGeneratedSpecs: () => true,
    }));
    mkdirSync(SPECS_FOLDER, { recursive: true });
    const template = Template.fromStack(await createGlobalStack());

    template.hasResourceProperties("Custom::CDKBucketDeployment", {
      DestinationBucketKeyPrefix: "docs/",
      Prune: true,
      SourceObjectKeys: Match.arrayEquals([Match.anyValue(), Match.anyValue()]),
    });
  });

  it("uploads only the docs UI and prunes nothing when the specs are not generated", async () => {
    vi.doMock("../utils/openapi-specs", () => ({
      hasGeneratedSpecs: () => false,
    }));
    const template = Template.fromStack(await createGlobalStack());

    template.hasResourceProperties("Custom::CDKBucketDeployment", {
      DestinationBucketKeyPrefix: "docs/",
      Prune: false,
      SourceObjectKeys: Match.arrayEquals([Match.anyValue()]),
    });
  });
});
