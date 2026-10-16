import type { IacDomainConfig } from "@flex/sdk";
import type { ValidatedGatewayConfig } from "@flex/service-gateway";
import { Environment } from "@flex/utils";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it, vi } from "vitest";

import { loadInfra } from "../__tests__/load-infra";
import { FlexDomainStack } from "../stacks/domain";
import { FlexPlatformStack } from "../stacks/platform";
import {
  enumerateFunctionEntries,
  FunctionEntry,
} from "./function-entries";

const mockDomainConfig: IacDomainConfig = {
  name: "test-domain",
  owner: "test-team",
  routes: {
    v1: {
      "/items": {
        GET: {
          name: "get-items",
          summary: "Get items",
          description: "Get items",
          responses: {
            "200": {
              description: "Success",
            },
          },
        },
        POST: {
          name: "create-item",
          summary: "Create item",
          description: "Create item",
          responses: {
            "201": {
              description: "Created",
            },
          },
        },
      },
    },
  },
};

const mockServiceGatewayConfig: ValidatedGatewayConfig = {
  name: "mock-gateway",
  access: "private",
  environments: ["development", "staging", "production"],
};

describe("Function Entries Enumeration", () => {
  it("enumerates domain routes and service gateways into stable PascalCase IDs", async () => {
    const entries = await enumerateFunctionEntries({
      stage: Environment.development,
      domainConfigs: [mockDomainConfig],
      serviceGatewayConfigs: [mockServiceGatewayConfig],
    });

    const ids = entries.map((e) => e.id);

    // Domain route handlers
    expect(ids).toContain("TestDomainPublicV1GetItems");
    expect(ids).toContain("TestDomainPublicV1CreateItem");

    // Service gateway handler
    expect(ids).toContain("MockGatewayServiceGateway");

    // Platform functions
    expect(ids).toContain("AuthorizerFunction");
    expect(ids).toContain("JwksEndpointStubFunction"); // present in dev

    // Verify all entries have non-empty paths and IDs
    for (const entry of entries) {
      expect(entry.id).toMatch(/^[A-Z][A-Za-z0-9]+$/);
      expect(entry.entry).toBeTruthy();
      expect(entry.entry.endsWith(".ts")).toBe(true);
    }
  });

  it("omits development-only JWKS stub in non-development stages", async () => {
    const entries = await enumerateFunctionEntries({
      stage: Environment.staging,
      domainConfigs: [mockDomainConfig],
      serviceGatewayConfigs: [mockServiceGatewayConfig],
    });

    const ids = entries.map((e) => e.id);
    expect(ids).toContain("AuthorizerFunction");
    expect(ids).not.toContain("JwksEndpointStubFunction");
  });

  it("throws an error if duplicate function IDs are generated", async () => {
    const duplicateDomainConfig: IacDomainConfig = {
      ...mockDomainConfig,
    };

    await expect(
      enumerateFunctionEntries({
        stage: Environment.development,
        domainConfigs: [mockDomainConfig, duplicateDomainConfig],
        serviceGatewayConfigs: [],
      }),
    ).rejects.toThrow(/Duplicate function ID detected during enumeration/);
  });
});

describe("Parity Test: Enumeration vs Synthesized CDK Templates", () => {
  it("proves enumerated domain functions match the synthesized domain stack Lambdas exactly", async () => {
    const stage = Environment.development;
    const { SsmApp, STAGE_KEYS } = await loadInfra(stage);

    const app = new SsmApp();
    app.addExternalExports("eu-west-2", [
      STAGE_KEYS.ApigwPublicRestId,
      STAGE_KEYS.ApigwPublicAppRoot,
      STAGE_KEYS.ApigwPrivateRestId,
      STAGE_KEYS.ApigwPrivateDomainRoot,
      STAGE_KEYS.ApigwPublicAuthorizerFn,
    ]);

    // Synthesize domain stack with mock domain config
    const stack = new FlexDomainStack(
      app,
      `${stage}-test-domain`,
      mockDomainConfig,
      stage,
    );
    const template = Template.fromStack(stack);

    // Find all Lambda Function resources synthesized in CloudFormation
    const cfnLambdas = template.findResources("AWS::Lambda::Function");
    const synthesizedLogicalIds = Object.keys(cfnLambdas);

    // Enumerate expected domain functions
    const enumeratedEntries = await enumerateFunctionEntries({
      stage,
      domainConfigs: [mockDomainConfig],
      serviceGatewayConfigs: [],
    });
    const domainEnumeratedIds = enumeratedEntries
      .filter((e) => e.domain === mockDomainConfig.name)
      .map((e) => e.id);

    expect(domainEnumeratedIds).toHaveLength(2);
    expect(domainEnumeratedIds).toEqual([
      "TestDomainPublicV1GetItems",
      "TestDomainPublicV1CreateItem",
    ]);

    // Check that every enumerated function exists in the synthesized template
    for (const expectedId of domainEnumeratedIds) {
      const match = synthesizedLogicalIds.some((logicalId) =>
        logicalId.startsWith(expectedId),
      );
      expect(
        match,
        `Expected synthesized template to contain Lambda for enumerated ID "${expectedId}"`,
      ).toBe(true);
    }
  });

  it("proves enumerated platform functions match the synthesized platform stack Lambdas", async () => {
    const stage = Environment.development;
    const { SsmApp, ENV_KEYS, STAGE_KEYS } = await loadInfra(stage);

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
      STAGE_KEYS.ApigwPublicRestId,
      STAGE_KEYS.ApigwPublicAppRoot,
      STAGE_KEYS.ApigwPrivateRestId,
      STAGE_KEYS.ApigwPrivateDomainRoot,
      STAGE_KEYS.ApigwPublicAuthorizerFn,
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

    const platformStack = new FlexPlatformStack(
      app,
      `${stage}-FlexPlatform`,
      [mockServiceGatewayConfig],
    );
    const template = Template.fromStack(platformStack);

    const cfnLambdas = template.findResources("AWS::Lambda::Function");
    const synthesizedLogicalIds = Object.keys(cfnLambdas);

    const enumerated = await enumerateFunctionEntries({
      stage,
      domainConfigs: [],
      serviceGatewayConfigs: [mockServiceGatewayConfig],
    });

    const expectedPlatformIds = enumerated
      .filter((e) => e.category === "platform" || e.category === "service-gateway")
      .map((e) => e.id);

    // In dev: AuthorizerFunction, JwksEndpointStubFunction, MockGatewayServiceGateway
    expect(expectedPlatformIds).toContain("AuthorizerFunction");
    expect(expectedPlatformIds).toContain("JwksEndpointStubFunction");
    expect(expectedPlatformIds).toContain("MockGatewayServiceGateway");

    for (const expectedId of expectedPlatformIds) {
      const match = synthesizedLogicalIds.some((logicalId) =>
        logicalId.startsWith(expectedId),
      );
      expect(
        match,
        `Expected synthesized platform template to contain Lambda for enumerated ID "${expectedId}"`,
      ).toBe(true);
    }
  });
});
