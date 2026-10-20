import type { ValidatedGatewayConfig } from "@flex/service-gateway";
import { Match, Template } from "aws-cdk-lib/assertions";
import { SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAlarmActions,
  createTestStack,
} from "../../__tests__/alarm-actions";
import { FIXTURE_MANIFEST_PATH, loadInfra } from "../../__tests__/load-infra";
import {
  ManifestNotFoundError,
  MissingArtifactEntryError,
} from "../../utils/manifest";

const mockGatewayConfig: ValidatedGatewayConfig = {
  name: "mock-gateway",
  access: "private",
  environments: ["development", "staging", "production"],
};

describe("Flex Lambda Constructs — Signed Code & CodeSigningConfig (PLAT-881)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("emits versioned signed S3 Code and enforced CodeSigningConfig for FlexPublicFunction, FlexPrivateEgressFunction, and FlexPrivateIsolatedFunction", async () => {
    await loadInfra("development");
    const { FlexPublicFunction } = await import("./flex-public-function");
    const { FlexPrivateEgressFunction } = await import(
      "./flex-private-egress-function"
    );
    const { FlexPrivateIsolatedFunction } = await import(
      "./flex-private-isolated-function"
    );

    const stack = createTestStack();
    const actions = createAlarmActions(stack);
    const vpc = new Vpc(stack, "TestVpc");
    const sg = new SecurityGroup(stack, "TestSg", { vpc });

    new FlexPublicFunction(stack, "TestPublicFunction", {
      entry: "/fake/public.ts",
      domain: "test-domain",
      ...actions,
    });

    new FlexPrivateEgressFunction(stack, "TestPrivateEgressFunction", {
      entry: "/fake/egress.ts",
      domain: "test-domain",
      vpc,
      privateEgressSg: sg,
      ...actions,
    });

    new FlexPrivateIsolatedFunction(stack, "TestPrivateIsolatedFunction", {
      entry: "/fake/isolated.ts",
      domain: "test-domain",
      vpc,
      privateIsolatedSg: sg,
      ...actions,
    });

    const template = Template.fromStack(stack);

    // 1. Verify a single shared CodeSigningConfig with ENFORCE is created on the stack
    template.resourceCountIs("AWS::Lambda::CodeSigningConfig", 1);
    template.hasResourceProperties("AWS::Lambda::CodeSigningConfig", {
      CodeSigningPolicies: {
        UntrustedArtifactOnDeployment: "Enforce",
      },
      AllowedPublishers: {
        SigningProfileVersionArns: [Match.anyValue()],
      },
    });

    // 2. Verify each function carries S3Key, S3ObjectVersion from manifest + CodeSigningConfigArn
    for (const expected of [
      {
        key: "assets/TestPublicFunction/778899001122/job-public.zip",
        version: "ver-public-001",
      },
      {
        key: "assets/TestPrivateEgressFunction/889900112233/job-egress.zip",
        version: "ver-egress-001",
      },
      {
        key: "assets/TestPrivateIsolatedFunction/990011223344/job-isolated.zip",
        version: "ver-isolated-001",
      },
    ]) {
      template.hasResourceProperties("AWS::Lambda::Function", {
        Handler: "index.handler",
        Runtime: "nodejs24.x",
        Code: {
          S3Bucket: Match.anyValue(),
          S3Key: expected.key,
          S3ObjectVersion: expected.version,
        },
        CodeSigningConfigArn: {
          "Fn::GetAtt": [
            Match.stringLikeRegexp("^LambdaCodeSigningConfig"),
            "CodeSigningConfigArn",
          ],
        },
      });
    }
  });

  it("emits signed code and CodeSigningConfig for JwksEndpointStubFunction in development", async () => {
    const { SsmApp, ENV_KEYS } = await loadInfra("development");
    const { FlexPlatformStack } = await import("../../stacks/platform");

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
      `${ENV_KEYS.Vpc}/vpc-id`,
      `${ENV_KEYS.Vpc}/vpc-cidr`,
      `${ENV_KEYS.Vpc}/availability-zones`,
      `${ENV_KEYS.Vpc}/public-subnet-ids`,
      `${ENV_KEYS.Vpc}/public-subnet-route-table-ids`,
      `${ENV_KEYS.Vpc}/private-subnet-ids`,
      `${ENV_KEYS.Vpc}/private-subnet-route-table-ids`,
      `${ENV_KEYS.Vpc}/isolated-subnet-ids`,
      `${ENV_KEYS.Vpc}/isolated-subnet-route-table-ids`,
    ]);

    const stack = new FlexPlatformStack(app, "development-FlexPlatform", []);
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::Lambda::Function", {
      Code: {
        S3Bucket: Match.anyValue(),
        S3Key: "assets/JwksEndpointStubFunction/b2c3d4e5f6a1/job-jwks.zip",
        S3ObjectVersion: "ver-jwks-001",
      },
      CodeSigningConfigArn: Match.anyValue(),
    });
  });

  it("preserves service-gateway live alias and ProvisionedConcurrencyConfig on plain Function in staging", async () => {
    const { SsmApp, ENV_KEYS } = await loadInfra("staging");
    const { FlexPlatformStack } = await import("../../stacks/platform");

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
      `${ENV_KEYS.Vpc}/vpc-id`,
      `${ENV_KEYS.Vpc}/vpc-cidr`,
      `${ENV_KEYS.Vpc}/availability-zones`,
      `${ENV_KEYS.Vpc}/public-subnet-ids`,
      `${ENV_KEYS.Vpc}/public-subnet-route-table-ids`,
      `${ENV_KEYS.Vpc}/private-subnet-ids`,
      `${ENV_KEYS.Vpc}/private-subnet-route-table-ids`,
      `${ENV_KEYS.Vpc}/isolated-subnet-ids`,
      `${ENV_KEYS.Vpc}/isolated-subnet-route-table-ids`,
    ]);

    const stack = new FlexPlatformStack(app, "staging-FlexPlatform", [
      mockGatewayConfig,
    ]);
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::Lambda::Alias", {
      Name: "live",
      ProvisionedConcurrencyConfig: {
        ProvisionedConcurrentExecutions: 2,
      },
    });
  });

  it("fails synth loudly naming the offending function when an entry is missing from the manifest", async () => {
    await loadInfra("development");
    vi.stubEnv("SIGNED_ARTIFACTS_MANIFEST_PATH", FIXTURE_MANIFEST_PATH);
    const { FlexPublicFunction } = await import("./flex-public-function");

    const stack = createTestStack();
    const actions = createAlarmActions(stack);

    expect(
      () =>
        new FlexPublicFunction(stack, "NonExistentFunctionId", {
          entry: "/fake/missing.ts",
          ...actions,
        }),
    ).toThrowError(MissingArtifactEntryError);

    expect(
      () =>
        new FlexPublicFunction(stack, "AnotherMissingFunctionId", {
          entry: "/fake/missing.ts",
          ...actions,
        }),
    ).toThrow(/No signed artifact found for function ID "AnotherMissingFunctionId"/);
  });

  it("fails synth loudly when the manifest file does not exist", async () => {
    await loadInfra("development");
    vi.stubEnv(
      "SIGNED_ARTIFACTS_MANIFEST_PATH",
      "/non-existent/path/signed-artifacts.manifest.json",
    );
    const { FlexPublicFunction } = await import("./flex-public-function");

    const stack = createTestStack();
    const actions = createAlarmActions(stack);

    expect(
      () =>
        new FlexPublicFunction(stack, "TestPublicFunction", {
          entry: "/fake/public.ts",
          ...actions,
        }),
    ).toThrowError(ManifestNotFoundError);
  });
});
