/* eslint-disable no-empty-pattern */
import { it as vitestIt, vi } from "vitest";

import { createDynamoFixture } from "../fixtures/dynamo";
import type { EnvFixture } from "../fixtures/env";
import { createEnv } from "../fixtures/env";
import type { HttpFixture } from "../fixtures/http";
import { createHttp } from "../fixtures/http";
import { buildLambdaContext } from "../fixtures/lambda";
import type { PlatformFixture } from "../fixtures/platform";
import {
  buildPlatformAuthorizerEvent,
  buildPlatformAuthorizerResult,
  buildPlatformCloudFrontResult,
  buildPlatformGatewayResult,
  createPlatformCloudFrontEvent,
  createPlatformGatewayEvent,
} from "../fixtures/platform";
import type { SdkFixture } from "../fixtures/sdk";
import {
  buildSdkResult,
  createSdkContext,
  createSdkEvent,
} from "../fixtures/sdk";
import { createSecretFixture } from "../fixtures/secret";

interface Fixtures {
  env: EnvFixture;
  http: HttpFixture;
  platform: PlatformFixture;
  sdk: SdkFixture;
}

export const it = vitestIt.extend<Fixtures>({
  env: [
    async ({}, use) => {
      await use(createEnv());
      vi.unstubAllEnvs();
    },
    { auto: true },
  ],
  http: [
    async ({}, use) => {
      using http = createHttp();
      await use(http);
    },
    { auto: true },
  ],
  platform: async ({}, use) => {
    await use({
      gatewayEvent: createPlatformGatewayEvent(),
      gatewayResult: buildPlatformGatewayResult,
      authorizerEvent: buildPlatformAuthorizerEvent,
      authorizerResult: buildPlatformAuthorizerResult,
      cloudFrontEvent: createPlatformCloudFrontEvent(),
      cloudFrontResult: buildPlatformCloudFrontResult,
      context: buildLambdaContext,
      dynamo: createDynamoFixture(),
      secret: createSecretFixture(),
    });
  },
  sdk: async ({}, use) =>
    use({
      event: createSdkEvent(),
      context: createSdkContext(),
      result: buildSdkResult,
    }),
});
