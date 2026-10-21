import type { IacDomainConfig } from "@flex/sdk";
import type { ValidatedGatewayConfig } from "@flex/service-gateway";
import { Aspects, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { CfnFunction, Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadInfra } from "../__tests__/load-infra";
import { CfnPause } from "../constructs/infra/CfnPause";
import {
  applyCodeSigningExemption,
  CODE_SIGNING_EXEMPTION_METADATA_KEY,
  EnforceLambdaCodeSigning,
} from "./enforce-lambda-code-signing";

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

const mockDomainConfig: IacDomainConfig = {
  name: "test-domain",
  owner: "test-team",
  routes: {
    v1: {
      "/items": {
        GET: {
          public: {
            name: "get-items",
          },
        },
      },
    },
  },
};

const mockGatewayConfig: ValidatedGatewayConfig = {
  name: "mock-gateway",
  access: "private",
  environments: ["development", "staging", "production"],
};

describe("EnforceLambdaCodeSigning Aspect", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails synth when a Lambda function lacks CodeSigningConfigArn and versioned S3 Code", async () => {
    const { SsmApp } = await loadInfra("development");
    const app = new SsmApp();
    Aspects.of(app).add(new EnforceLambdaCodeSigning());

    const stack = new Stack(app, "UnsignedTestStack");
    new Function(stack, "UnsignedTeamLambda", {
      runtime: Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: Code.fromInline("exports.handler = async () => ({});"),
    });

    expect(() => Template.fromStack(stack)).toThrow(
      /Lambda function "UnsignedTestStack\/UnsignedTeamLambda\/Resource" is missing required code signing configuration/,
    );
  });

  it("allows an exempted provider Lambda when a valid audit reason is provided", async () => {
    const { SsmApp } = await loadInfra("development");
    const app = new SsmApp();
    Aspects.of(app).add(new EnforceLambdaCodeSigning());

    const stack = new Stack(app, "ExemptProviderStack");
    new CfnPause(stack, "TestPause", 5);

    expect(() => Template.fromStack(stack)).not.toThrow();
  });

  it("fails immediately when applyCodeSigningExemption is called with an empty reason", async () => {
    const { SsmApp } = await loadInfra("development");
    const app = new SsmApp();
    const stack = new Stack(app, "InvalidExemptionStack");
    const fn = new Function(stack, "Fn", {
      runtime: Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: Code.fromInline("exports.handler = async () => ({});"),
    });

    expect(() => applyCodeSigningExemption(fn, "   ")).toThrow(
      /Code signing exemption on "InvalidExemptionStack\/Fn" requires a non-empty audit reason/,
    );
  });

  it("fails at synth time if raw exemption metadata is attached without a reason", async () => {
    const { SsmApp } = await loadInfra("development");
    const app = new SsmApp();
    Aspects.of(app).add(new EnforceLambdaCodeSigning());

    const stack = new Stack(app, "RawMetadataBypassStack");
    const fn = new Function(stack, "Fn", {
      runtime: Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: Code.fromInline("exports.handler = async () => ({});"),
    });
    const cfnFn = fn.node.defaultChild as CfnFunction;
    cfnFn.addMetadata(CODE_SIGNING_EXEMPTION_METADATA_KEY, { reason: "" });

    expect(() => Template.fromStack(stack)).toThrow(
      /Code signing exemption on "RawMetadataBypassStack\/Fn\/Resource" requires a non-empty audit reason/,
    );
  });

  it("synthesizes all application stacks cleanly with EnforceLambdaCodeSigning enabled and verifies every non-exempt Lambda has signed code config", async () => {
    const stage = "development";
    const { SsmApp, ENV_KEYS, PLATFORM_KEYS, STAGE_KEYS } =
      await loadInfra(stage);
    const { FlexCoreStack } = await import("../stacks/core/stack");
    const { FlexPlatformStack } = await import("../stacks/platform");
    const { FlexDomainStack } = await import("../stacks/domain");
    const { FlexSmokeTestStack } = await import("../stacks/smoke-test");
    const { FlexCredentialMonitorStack } =
      await import("../stacks/credential-monitor");
    const { FlexApiDeploymentStack } = await import("../stacks/deploy");
    const { FlexGlobalStack } = await import("../stacks/global");

    const app = new SsmApp();
    Aspects.of(app).add(new EnforceLambdaCodeSigning());

    app.addExternalExports("eu-west-2", [
      PLATFORM_KEYS.HostedZoneId,
      PLATFORM_KEYS.HostedZoneName,
      PLATFORM_KEYS.SignedArtifactsBucket,
      PLATFORM_KEYS.SigningProfileName,
      PLATFORM_KEYS.SigningProfileVersion,
      PLATFORM_KEYS.SigningPlatformKeyFingerprint,
      ENV_KEYS.AuthClientId,
      ENV_KEYS.AuthClientIdStub,
      ENV_KEYS.AuthUserPoolId,
      ENV_KEYS.AuthUserPoolIdStub,
      ENV_KEYS.MonitoringSlackWorkspaceId,
      ENV_KEYS.MonitoringSlackChannelId,
      ENV_KEYS.ReleaseSlackChannelId,
      ENV_KEYS.DvlaConfigSecretArn,
      STAGE_KEYS.ApigwPublicRestId,
      STAGE_KEYS.ApigwPublicAppRoot,
      STAGE_KEYS.ApigwPrivateRestId,
      STAGE_KEYS.ApigwPrivateDomainRoot,
      STAGE_KEYS.ApigwPublicAuthorizerFn,
      STAGE_KEYS.WafCfSecretHeaderArn,
      ...VPC_EXPORTS.map((key) => `${ENV_KEYS.Vpc}/${key}`),
    ]);

    const coreStack = new FlexCoreStack(app, `${stage}-FlexCore`);
    const platformStack = new FlexPlatformStack(app, `${stage}-FlexPlatform`, [
      mockGatewayConfig,
    ]);
    const domainStack = new FlexDomainStack(
      app,
      `${stage}-test-domain`,
      mockDomainConfig,
      stage,
    );
    const smokeTestStack = new FlexSmokeTestStack(
      app,
      `${stage}-FlexSmokeTest`,
    );
    const credentialMonitorStack = new FlexCredentialMonitorStack(
      app,
      `${stage}-FlexCredentialMonitor`,
    );
    const deployStack = new FlexApiDeploymentStack(
      app,
      `${stage}-FlexApiDeployment`,
      {
        deployedDomains: [`${stage}-test-domain`],
        publicRouteBindings: domainStack.publicRouteBindings,
        privateRouteBindings: domainStack.privateRouteBindings,
      },
    );
    const globalStack = new FlexGlobalStack(app, `${stage}-FlexGlobal`);

    const teamLambdaStacks = [
      coreStack,
      platformStack,
      domainStack,
      smokeTestStack,
      credentialMonitorStack,
    ];

    for (const stack of teamLambdaStacks) {
      const template = Template.fromStack(stack);
      const functions = template.findResources("AWS::Lambda::Function");
      const functionEntries = Object.entries(functions);
      expect(functionEntries.length).toBeGreaterThan(0);

      for (const [logicalId, resource] of functionEntries) {
        const props = (
          resource as {
            Properties: {
              CodeSigningConfigArn?: unknown;
              Code?: {
                S3Bucket?: unknown;
                S3Key?: unknown;
                S3ObjectVersion?: unknown;
              };
            };
          }
        ).Properties;

        expect(
          props.CodeSigningConfigArn,
          `Expected ${stack.stackName}.${logicalId} to have CodeSigningConfigArn`,
        ).toBeDefined();
        expect(
          props.Code?.S3Bucket,
          `Expected ${stack.stackName}.${logicalId} to have Code.S3Bucket`,
        ).toBeDefined();
        expect(
          props.Code?.S3Key,
          `Expected ${stack.stackName}.${logicalId} to have Code.S3Key`,
        ).toBeDefined();
        expect(
          props.Code?.S3ObjectVersion,
          `Expected ${stack.stackName}.${logicalId} to have Code.S3ObjectVersion`,
        ).toBeDefined();
      }
    }

    // Provider-only / global stacks also pass aspect validation cleanly
    expect(() => Template.fromStack(deployStack)).not.toThrow();
    expect(() => Template.fromStack(globalStack)).not.toThrow();
  });
});
