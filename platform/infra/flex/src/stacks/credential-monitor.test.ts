import { Match, Template } from "aws-cdk-lib/assertions";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const ACCOUNT = "123456789012";

interface PolicyStatementJson {
  Action: string | string[];
  Resource: unknown;
  Condition?: unknown;
}

async function synthesiseFor(stage: string) {
  vi.resetModules();
  vi.stubEnv("STAGE", stage);
  vi.stubEnv("CDK_DEFAULT_ACCOUNT", ACCOUNT);

  const { SsmApp } = await import("../base");
  const { ENV_KEYS, STAGE_KEYS } = await import("../ssm-keys");
  const { FlexCredentialMonitorStack } = await import("./credential-monitor");

  const app = new SsmApp();
  app.addExternalExports("eu-west-2", [
    ENV_KEYS.TopicCriticalAlarms,
    ENV_KEYS.TopicWarningAlarms,
    ENV_KEYS.DvlaConfigSecretArn,
    ENV_KEYS.UdpConfigSecretArn,
    ENV_KEYS.UnsConfigSecret,
    STAGE_KEYS.ApigwPublicAuthorizerFn,
  ]);

  const stack = new FlexCredentialMonitorStack(
    app,
    `${stage}-FlexCredentialMonitor`,
  );

  return Template.fromStack(stack);
}

function statementsOf(template: Template): PolicyStatementJson[] {
  const policies = Object.values(
    template.findResources("AWS::IAM::Policy"),
  ) as {
    Properties: { PolicyDocument: { Statement: PolicyStatementJson[] } };
  }[];

  return policies.flatMap(
    ({ Properties }) => Properties.PolicyDocument.Statement,
  );
}

function statementWith(template: Template, action: string) {
  return statementsOf(template).find(({ Action }) =>
    [Action].flat().includes(action),
  );
}

function monitorEnvironment(template: Template) {
  const functions = Object.values(
    template.findResources("AWS::Lambda::Function", {
      Properties: { Environment: { Variables: Match.anyValue() } },
    }),
  ) as {
    Properties: { Environment: { Variables: Record<string, unknown> } };
  }[];

  const monitor = functions.find(
    ({ Properties }) =>
      "MAXIMUM_AGE_SECRETS" in Properties.Environment.Variables,
  );

  return monitor?.Properties.Environment.Variables ?? {};
}

describe("FlexCredentialMonitorStack", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("in staging", () => {
    let template: Template;

    beforeAll(async () => {
      template = await synthesiseFor("staging");
      vi.unstubAllEnvs();
    });

    it("configures the policy's 90-day rotation interval", () => {
      expect(monitorEnvironment(template)).toMatchObject({
        MAXIMUM_ROTATION_INTERVAL_DAYS: "90",
        FLEX_ENVIRONMENT: "staging",
      });
    });

    it("checks the real Cognito parameters against the authorizer", () => {
      const variables = monitorEnvironment(template);

      expect(JSON.parse(variables.COGNITO_PARAMETERS as string)).toEqual([
        {
          parameterName: "/staging/flex-param/auth/user-pool-id",
          environmentVariable: "USERPOOL_ID",
        },
        {
          parameterName: "/staging/flex-param/auth/client-id",
          environmentVariable: "CLIENT_ID",
        },
      ]);
    });

    it("requires DVLA, UDP, UNS, the smoke test user and the E2E test user to be younger than 90 days", () => {
      const maximumAge = JSON.stringify(
        monitorEnvironment(template).MAXIMUM_AGE_SECRETS,
      );

      [
        "flexparamdvlaconsumerconfigsecretarn",
        "flexparamudpconsumerconfigsecretarn",
        "flexparamunsconsumerconfigsecret",
        "/staging/flex-secret/smoke-test/user",
        "/staging/flex-secret/e2e/test_user",
      ].forEach((reference) => {
        expect(maximumAge).toContain(reference);
      });
      expect(maximumAge.match(/maxAgeDays\\":90/g)).toHaveLength(5);
      expect(maximumAge).not.toContain("private_jwk");
    });

    it("lists secret metadata without reading any secret value", () => {
      expect(
        statementWith(template, "secretsmanager:ListSecrets"),
      ).toMatchObject({
        Resource: "*",
      });
      expect(
        statementWith(template, "secretsmanager:GetSecretValue"),
      ).toBeUndefined();
    });

    it("reads version metadata of exactly the five required secrets", () => {
      const resources = statementWith(
        template,
        "secretsmanager:ListSecretVersionIds",
      )?.Resource as unknown[];

      expect(resources).toHaveLength(5);
      expect(resources).toEqual(
        expect.arrayContaining([
          `arn:aws:secretsmanager:eu-west-2:${ACCOUNT}:secret:/staging/flex-secret/smoke-test/user-??????`,
          `arn:aws:secretsmanager:eu-west-2:${ACCOUNT}:secret:/staging/flex-secret/e2e/test_user-??????`,
        ]),
      );
    });

    it("reads only the two Cognito parameters", () => {
      expect(statementWith(template, "ssm:GetParameter")?.Resource).toEqual([
        `arn:aws:ssm:eu-west-2:${ACCOUNT}:parameter/staging/flex-param/auth/user-pool-id`,
        `arn:aws:ssm:eu-west-2:${ACCOUNT}:parameter/staging/flex-param/auth/client-id`,
      ]);
    });

    it("reads the authorizer's configuration and can decrypt its environment", () => {
      expect(
        statementWith(template, "lambda:GetFunctionConfiguration"),
      ).toBeDefined();
      expect(statementWith(template, "kms:Decrypt")).toBeDefined();
    });

    it("publishes metrics only to the Flex/Credentials namespace", () => {
      expect(statementWith(template, "cloudwatch:PutMetricData")).toMatchObject(
        {
          Resource: "*",
          Condition: {
            StringEquals: { "cloudwatch:namespace": "Flex/Credentials" },
          },
        },
      );
    });

    it("runs the monitor every hour", () => {
      template.hasResourceProperties("AWS::Events::Rule", {
        ScheduleExpression: "rate(1 hour)",
      });
    });

    it("creates the five credential monitor alarms and no default Lambda alarms", () => {
      template.resourceCountIs("AWS::CloudWatch::Alarm", 5);
    });
  });

  describe("in development", () => {
    let template: Template;

    beforeAll(async () => {
      template = await synthesiseFor("development");
      vi.unstubAllEnvs();
    });

    it("checks the stub Cognito parameters the development authorizer uses", () => {
      const variables = monitorEnvironment(template);

      expect(JSON.parse(variables.COGNITO_PARAMETERS as string)).toEqual([
        {
          parameterName: "/development/flex-param/auth/stub/user-pool-id",
          environmentVariable: "USERPOOL_ID",
        },
        {
          parameterName: "/development/flex-param/auth/stub/client-id",
          environmentVariable: "CLIENT_ID",
        },
      ]);
    });

    it("requires the E2E private JWK instead of the E2E test user", () => {
      const maximumAge = JSON.stringify(
        monitorEnvironment(template).MAXIMUM_AGE_SECRETS,
      );

      expect(maximumAge).toContain(
        "/development/flex-secret/auth/e2e/private_jwk",
      );
      expect(maximumAge).not.toContain("e2e/test_user");
    });
  });
});
