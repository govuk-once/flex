/* eslint-disable no-empty-pattern */
import type { UserId } from "@flex/utils";
import { it as vitestIt, vi } from "vitest";

import {
  createAuthorizerEvent,
  createAuthorizerResult,
  createContext,
  createEvent,
  createEventWithAuthorizer,
  createMiddyRequest,
  createResponse,
} from "../fixtures";
import { createRestApiEvent } from "../fixtures/apigateway";
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
import { createSdkContext, createSdkEvent } from "../fixtures/sdk";
import { createUserId } from "../fixtures/user";

interface Fixtures {
  env: EnvFixture;
  http: HttpFixture;
  platform: PlatformFixture;
  sdk: SdkFixture;
  // TODO: Remove unused fixtures
  authorizerEvent: ReturnType<typeof createAuthorizerEvent>;
  authorizerResult: ReturnType<typeof createAuthorizerResult>;
  context: ReturnType<typeof createContext>;
  event: ReturnType<typeof createEvent>;
  eventWithAuthorizer: ReturnType<typeof createEventWithAuthorizer>;
  middy: ReturnType<typeof createMiddyRequest>;
  privateGatewayEvent: ReturnType<typeof createRestApiEvent>;
  response: ReturnType<typeof createResponse>;
  userId: UserId;
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
    });
  },
  sdk: async ({}, use) =>
    use({
      event: createSdkEvent(),
      context: createSdkContext(),
    }),
  // TODO: Remove unused fixtures
  authorizerEvent: async ({}, use) => use(createAuthorizerEvent()),
  authorizerResult: async ({}, use) => use(createAuthorizerResult()),
  context: async ({}, use) => use(createContext()),
  event: async ({}, use) => use(createEvent()),
  eventWithAuthorizer: async ({}, use) => use(createEventWithAuthorizer()),
  middy: async ({}, use) => use(createMiddyRequest()),
  privateGatewayEvent: async ({}, use) => use(createRestApiEvent()),
  response: async ({}, use) => use(createResponse()),
  userId: async ({}, use) => use(createUserId()),
});
