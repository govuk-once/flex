import { Match, Template } from "aws-cdk-lib/assertions";
import { afterAll, beforeAll, describe, it, vi } from "vitest";

import { loadInfra } from "../__tests__/load-infra";

describe("FlexSmokeTestStack", () => {
  let template: Template;

  beforeAll(async () => {
    const { SsmApp, ENV_KEYS } = await loadInfra("staging");
    const { FlexSmokeTestStack } = await import("./smoke-test");

    const app = new SsmApp();
    app.addExternalExports("eu-west-2", [
      ENV_KEYS.TopicCriticalAlarms,
      ENV_KEYS.TopicWarningAlarms,
    ]);

    template = Template.fromStack(
      new FlexSmokeTestStack(app, "staging-FlexSmokeTest"),
    );
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("publishes metrics only to the Flex/SmokeTest namespace", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          {
            Effect: "Allow",
            Action: "cloudwatch:PutMetricData",
            Resource: "*",
            Condition: {
              StringEquals: { "cloudwatch:namespace": "Flex/SmokeTest" },
            },
          },
        ]),
      },
    });
  });

  it("enforces signed code configuration on the smoke test Lambda", () => {
    const codeSigningConfigs = template.findResources(
      "AWS::Lambda::CodeSigningConfig",
    );
    const [cscLogicalId] = Object.keys(codeSigningConfigs);

    template.hasResourceProperties("AWS::Lambda::Function", {
      CodeSigningConfigArn: {
        "Fn::GetAtt": [cscLogicalId, "CodeSigningConfigArn"],
      },
      Code: {
        S3Bucket: Match.anyValue(),
        S3Key: "assets/SmokeTestFunction/d4e5f6a1b2c3/job-smoke.zip",
        S3ObjectVersion: "ver-smoke-test-001",
      },
    });
  });
});
