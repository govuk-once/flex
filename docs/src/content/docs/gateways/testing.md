---
title: Testing gateways
description: How to unit test a service gateway's routes with the platform fixture, stubbed secrets and stubbed upstreams.
---

Each gateway tests its own route handlers in `src/gateway.test.ts`. The tests call the real
handler with an API Gateway event, so they cover routing, request validation, resource resolution,
error mapping and response validation as well as the handler itself. Upstream calls are stubbed;
nothing leaves the machine.

Tests use the `platform` fixture from `@flex/testing`, not the `sdk` fixture domains use. See
[`@flex/testing`](/flex/reference/flex-testing/) for the full fixture API.

## Vitest configuration

```ts title="vitest.config.ts"
import { config } from "@flex/config/vitest";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, "e2e/**"],
      setupFiles: ["@flex/testing/setup/platform"],
      env: {
        AWS_REGION: "eu-west-2",
        AWS_ACCESS_KEY_ID: "test-access-key-id", // pragma: allowlist secret
        AWS_SECRET_ACCESS_KEY: "test-secret-access-key", // pragma: allowlist secret
        FLEX_GATEWAY_NAME: "example",
      },
    },
  }),
);
```

| Setting | Why |
| --- | --- |
| `setupFiles` | `@flex/testing/setup/platform` blocks real network access, clears the Secrets Manager cache and AWS client mocks before each test, and replaces SigV4 signing with plain `fetch`, so `sigv4` clients can be stubbed like any other HTTP call |
| `FLEX_GATEWAY_NAME` | `platform.gatewayEvent` uses it to build the `/gateways/<name>/...` path the handler strips. Without it the fixture throws |
| AWS credentials | Placeholder values, so AWS SDK clients can sign requests to the mocks |

## Stubbing secrets

`platform.secret.resolves(name, value)` stubs a Secrets Manager read and returns the secret's ARN.
Put that ARN in the environment variable the resource's `env` names:

```ts
it.beforeEach(({ env, platform }) => {
  env.set({
    FLEX_EXAMPLE_CONSUMER_CONFIG_SECRET_ARN: platform.secret.resolves(
      "example-consumer",
      consumerConfig,
    ),
  });
});
```

`platform.secret.rejects(name)` makes the read fail, for testing the `500` path.

## Testing a REST route

Stub the upstream with the `http` fixture, call the handler with `platform.gatewayEvent`, and
compare against `platform.gatewayResult`:

```ts title="src/gateway.test.ts"
import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./gateway";

const consumerConfig = {
  apiKey: "test-api-key", // pragma: allowlist secret
  apiUrl: "https://example-api.test",
};

describe("Example service gateway", () => {
  it.beforeEach(({ env, platform }) => {
    env.set({
      FLEX_EXAMPLE_CONSUMER_CONFIG_SECRET_ARN: platform.secret.resolves(
        "example-consumer",
        consumerConfig,
      ),
    });
  });

  it("returns the upstream response", async ({ http, platform }) => {
    http
      .url(consumerConfig.apiUrl)
      .get("/remote/example/123", { query: { queryKey: "abc" } })
      .reply(200, { message: "ok" });

    const result = await handler(
      platform.gatewayEvent.get("/v1/example/123", {
        headers: { "x-custom-token": "test-token" },
        query: { queryKey: "abc" },
      }),
      platform.context(),
    );

    expect(result).toStrictEqual(
      platform.gatewayResult(200, { body: { message: "ok" } }),
    );
  });

  it("returns 502 when the upstream fails", async ({ http, platform }) => {
    http
      .url(consumerConfig.apiUrl)
      .get("/remote/example/123", { query: { queryKey: "abc" } })
      .reply(500);

    const result = await handler(
      platform.gatewayEvent.get("/v1/example/123", {
        headers: { "x-custom-token": "test-token" },
        query: { queryKey: "abc" },
      }),
      platform.context(),
    );

    expect(result).toStrictEqual(
      platform.gatewayResult(502, {
        body: { message: "EXAMPLE upstream service unavailable" },
      }),
    );
  });
});
```

A stub matches on method, path, and the `query`, `headers` and `body` it is given. The `http`
fixture fails the test if a stubbed call is never made, so a stub doubles as an assertion that the
gateway called the upstream as expected.

## Testing a DynamoDB route

`platform.dynamodb` stubs the commands `createDynamoDBClient` sends. Stub the result, call the
handler, and inspect the command input if the route's key or filter matters:

```ts
it("scans for enabled travel sources", async ({ platform }) => {
  platform.dynamodb.scan.resolves([franceRow]);

  const result = await handler(
    platform.gatewayEvent.get("/v1/countries"),
    platform.context(),
  );

  expect(result).toStrictEqual(platform.gatewayResult(200, { body: [france] }));
  expect(platform.dynamodb.scan.input()).toMatchObject({
    FilterExpression: "#0 = :0 AND #1 = :1",
    ExpressionAttributeValues: { ":0": "travel", ":1": true },
  });
});
```

`rejects` on any operation simulates an AWS error, such as throttling.

## What to cover

For each route, test:

- the success path, including any reshaping of the upstream's data
- each request validation failure the route can produce: missing headers, a bad query, a bad body
- a 4xx and a 5xx from the upstream
- a response that fails the route's `response` schema, if it has one

Once per gateway, test an unknown route returns `404`.

## Running the tests

```bash
pnpm --filter @flex/<name>-service-gateway test
pnpm --filter @flex/<name>-service-gateway test:coverage
```

Gateways are only reachable through the private API, so no end-to-end test calls one directly. They
are exercised through the domains that integrate with them, in each domain's module E2E tests. See
[Testing domains](/flex/domains/testing/) and [E2E tests](/flex/delivery/e2e-tests/).
