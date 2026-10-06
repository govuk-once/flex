import { Match, Template } from "aws-cdk-lib/assertions";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { loadInfra, TEST_ACCOUNT as ACCOUNT } from "../__tests__/load-infra";

interface PolicyStatementJson {
  Action: string | string[];
  Resource: unknown;
  Condition?: unknown;
}

async function synthesiseFor(stage: string) {
  const { SsmApp, ENV_KEYS, STAGE_KEYS } = await loadInfra(stage);
  const { FlexCredentialMonitorStack } = await import("./credential-monitor");

  const app = new SsmApp();
  app.addExternalExports("eu-west-2", [
    ENV_KEYS.TopicCriticalAlarms,
    ENV_KEYS.TopicWarningAlarms,
    ENV_KEYS.DvlaConfigSecretArn,
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

    it("configures the DVLA 60-day rotation interval", () => {
      expect(monitorEnvironment(template)).toMatchObject({
        MAXIMUM_ROTATION_INTERVAL_DAYS: "60",
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

    it("checks only DVLA against its 60-day rotation interval", () => {
      const maximumAge = JSON.stringify(
        monitorEnvironment(template).MAXIMUM_AGE_SECRETS,
      );

      expect(maximumAge).toContain("flexparamdvlaconsumerconfigsecretarn");
      expect(maximumAge.match(/maxAgeDays\\":60/g)).toHaveLength(1);
      expect(maximumAge).not.toContain("udp");
      expect(maximumAge).not.toContain("uns");
      expect(maximumAge).not.toContain("smoke-test");
      expect(maximumAge).not.toContain("test_user");
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

    it("reads version metadata of only the DVLA secret", () => {
      const resources = [
        statementWith(template, "secretsmanager:ListSecretVersionIds")
          ?.Resource,
      ].flat();

      expect(resources).toEqual([expect.anything()]);
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

    it("checks only DVLA in development too", () => {
      const maximumAge = JSON.stringify(
        monitorEnvironment(template).MAXIMUM_AGE_SECRETS,
      );

      expect(maximumAge).toContain("flexparamdvlaconsumerconfigsecretarn");
      expect(maximumAge).not.toContain("private_jwk");
      expect(maximumAge).not.toContain("test_user");
      expect(maximumAge).not.toContain("smoke-test");
    });
  });
});
