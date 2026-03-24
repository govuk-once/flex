import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CfnOutput, Stack } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { NextjsGlobalFunctions } from "cdk-nextjs";
import { Construct } from "constructs";

import { BaseStack } from "../base";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Root of the Next.js demo app — cdk-nextjs builds it as part of cdk deploy.
const DEMO_APP_DIR = resolve(__dirname, "../../../../../tests/demo-app");

interface FlexDemoAppStackProps {
  /**
   * The base URL of the deployed Flex Public API (e.g. https://api.flex.service.gov.uk).
   * Injected as FLEX_API_BASE_URL and NEXT_PUBLIC_API_BASE_URL into the Next.js runtime.
   */
  flexApiBaseUrl: string;
}

export class FlexDemoAppStack extends BaseStack {
  constructor(
    scope: Construct,
    id: string,
    { flexApiBaseUrl }: FlexDemoAppStackProps,
  ) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "N/A",
        ResourceOwner: "flex-demo-app",
        Source: "https://github.com/govuk-once/flex",
      },
      env: { region: "eu-west-2" },
    });

    const account = Stack.of(this).account;

    const nextjs = new NextjsGlobalFunctions(this, "DemoApp", {
      buildDirectory: DEMO_APP_DIR,
      healthCheckPath: "/api/health",
      overrides: {
        nextjsFunctions: {
          dockerImageFunctionProps: {
            environment: {
              STAGE: process.env.STAGE ?? "development",
              FLEX_API_BASE_URL: flexApiBaseUrl,
              NEXT_PUBLIC_API_BASE_URL: flexApiBaseUrl,
            },
          },
        },
      },
    });

    // Secrets Manager — development stub key + staging/production test user
    nextjs.nextjsFunctions.function.addToRolePolicy(
      new PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: [
          `arn:aws:secretsmanager:eu-west-2:${account}:secret:/development/flex-secret/auth/e2e/private_jwk-*`,
          `arn:aws:secretsmanager:eu-west-2:${account}:secret:/staging/flex-secret/e2e/test_user-*`,
          `arn:aws:secretsmanager:eu-west-2:${account}:secret:/production/flex-secret/e2e/test_user-*`,
          `arn:aws:secretsmanager:eu-west-2:${account}:secret:/staging/flex-secret/auth/client_secret-*`,
          `arn:aws:secretsmanager:eu-west-2:${account}:secret:/production/flex-secret/auth/client_secret-*`,
        ],
      }),
    );

    // SSM — auth parameters
    nextjs.nextjsFunctions.function.addToRolePolicy(
      new PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          `arn:aws:ssm:eu-west-2:${account}:parameter/*/flex-param/auth/*`,
        ],
      }),
    );

    new CfnOutput(this, "DemoAppUrl", {
      value: nextjs.url,
      description: "Demo app URL — share this with stakeholders",
    });
  }
}
