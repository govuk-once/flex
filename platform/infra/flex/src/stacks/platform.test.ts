import { Match, Template } from "aws-cdk-lib/assertions";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadInfra, TEST_ACCOUNT } from "../__tests__/load-infra";

const VPC_EXPORTS = [
  "vpc-id",
  "vpc-cidr",
  "availability-zones",
  "public-subnet-ids",
  "public-subnet-route-table-ids",
  "private-subnet-ids",
  "private-subnet-route-table-ids",
  "isolated-subnet-ids",
  "isolated-subnet-route-table-ids",
];

async function synthesise(stage: string) {
  const { SsmApp, ENV_KEYS } = await loadInfra(stage);
  const { FlexPlatformStack } = await import("./platform");

  const app = new SsmApp();
  app.addExternalExports("eu-west-2", [
    ENV_KEYS.AuthClientId,
    ENV_KEYS.AuthClientIdStub,
    ENV_KEYS.AuthUserPoolId,
    ENV_KEYS.AuthUserPoolIdStub,
    ENV_KEYS.SgPrivateEgress,
    ENV_KEYS.SgPrivateIsolated,
    ENV_KEYS.TopicCriticalAlarms,
    ENV_KEYS.TopicWarningAlarms,
    ENV_KEYS.VpcEApiGateway,
    ...VPC_EXPORTS.map((key) => `${ENV_KEYS.Vpc}/${key}`),
  ]);

  return Template.fromStack(
    new FlexPlatformStack(app, `${stage}-FlexPlatform`, []),
  );
}

function authorizerEnvironment(template: Template) {
  const functions = Object.values(
    template.findResources("AWS::Lambda::Function", {
      Properties: {
        Environment: {
          Variables: Match.objectLike({ USERPOOL_ID: Match.anyValue() }),
        },
      },
    }),
  ) as {
    Properties: { Environment: { Variables: Record<string, unknown> } };
  }[];

  expect(functions).toHaveLength(1);

  return functions[0]?.Properties.Environment.Variables ?? {};
}

function parameterReference(template: Template, name: string) {
  const [parameterId] = Object.entries(
    template.toJSON().Parameters as Record<string, { Default?: string }>,
  ).find(([, parameter]) => parameter.Default === name) ?? [undefined];

  return { Ref: parameterId };
}

describe("FlexPlatformStack authorizer", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the real Cognito parameters and JWKS URI in staging", async () => {
    const template = await synthesise("staging");
    const variables = authorizerEnvironment(template);
    const userPoolId = parameterReference(
      template,
      "/staging/flex-param/auth/user-pool-id",
    );

    expect(variables.USERPOOL_ID).toEqual(userPoolId);
    expect(variables.CLIENT_ID).toEqual(
      parameterReference(template, "/staging/flex-param/auth/client-id"),
    );
    expect(variables.JWKS_URI).toEqual({
      "Fn::Join": [
        "",
        [
          "https://cognito-idp.eu-west-2.amazonaws.com/",
          userPoolId,
          "/.well-known/jwks.json",
        ],
      ],
    });
    template.resourceCountIs("AWS::Lambda::Url", 0);
  });

  it("uses the stub Cognito parameters and stub JWKS endpoint in development", async () => {
    const template = await synthesise("development");
    const variables = authorizerEnvironment(template);
    const [functionUrlId] = Object.keys(
      template.findResources("AWS::Lambda::Url"),
    );

    expect(variables.USERPOOL_ID).toEqual(
      parameterReference(
        template,
        "/development/flex-param/auth/stub/user-pool-id",
      ),
    );
    expect(variables.CLIENT_ID).toEqual(
      parameterReference(
        template,
        "/development/flex-param/auth/stub/client-id",
      ),
    );
    expect(variables.JWKS_URI).toEqual({
      "Fn::GetAtt": [functionUrlId, "FunctionUrl"],
    });
  });
});

describe("FlexPlatformStack WAF request logging", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("logs blocked and counted API WAF requests to S3 with secret bearing headers redacted", async () => {
    const template = await synthesise("staging");
    const webAclId = Object.keys(
      template.findResources("AWS::WAFv2::WebACL"),
    )[0];
    const logBucketId = Object.keys(
      template.findResources("AWS::S3::Bucket", {
        Properties: { BucketName: "aws-waf-logs-flex-staging-api" },
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

  it("keeps API WAF logs for 90 days under a governance lock and only accepts them from log delivery in eu-west-2", async () => {
    const template = await synthesise("staging");

    template.hasResourceProperties("AWS::S3::Bucket", {
      BucketName: "aws-waf-logs-flex-staging-api",
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          { ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } },
        ],
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

    template.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: "AWSLogDeliveryWrite",
            Principal: { Service: "delivery.logs.amazonaws.com" },
            Action: "s3:PutObject",
            Condition: Match.objectLike({
              ArnLike: {
                "aws:SourceArn": {
                  "Fn::Join": [
                    "",
                    [
                      "arn:",
                      { Ref: "AWS::Partition" },
                      `:logs:eu-west-2:${TEST_ACCOUNT}:*`,
                    ],
                  ],
                },
              },
            }),
          }),
          Match.objectLike({
            Sid: "AWSLogDeliveryAclCheck",
            Principal: { Service: "delivery.logs.amazonaws.com" },
            Action: "s3:GetBucketAcl",
          }),
        ]),
      },
    });
  });

  it("does not log WAF requests for ephemeral stages", async () => {
    const template = await synthesise("my-branch-12");

    template.resourceCountIs("AWS::WAFv2::LoggingConfiguration", 0);
    template.resourceCountIs("AWS::S3::Bucket", 0);
  });
});
