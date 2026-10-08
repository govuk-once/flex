---
title: Creating a gateway
description: Add a service gateway for a new upstream, from the package to the first domain that calls it.
---

A gateway is a workspace package under `platform/domains/<name>/`. It holds the configuration, the
handler, the schemas for both sides of the contract, and the handler's tests. The platform
provisions it from the configuration, so there is no CDK to write. See
[How a service gateway works](/flex/gateways/overview/) for what gets created.

The directory name must match the gateway's `name`: the infrastructure builds the Lambda from
`platform/domains/<name>/src/gateway.ts`.

## 1. Create the package

```text
platform/domains/<name>/
├── src/
│   ├── gateway.ts
│   ├── gateway.test.ts
│   ├── index.ts          optional: schemas exported for domains to import
│   └── schemas/
│       ├── domain/       the shapes the gateway accepts and returns
│       └── remote/       the shapes the upstream accepts and returns
├── eslint.config.mjs
├── gateway.config.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

```json title="package.json"
{
  "name": "@flex/<name>-service-gateway",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "tsc": "tsc --noEmit",
    "lint": "eslint --max-warnings=0 .",
    "test": "vitest --passWithNoTests",
    "test:coverage": "vitest --coverage"
  },
  "dependencies": {
    "@flex/service-gateway": "workspace:*",
    "@flex/utils": "workspace:*",
    "zod": "<version>"
  },
  "devDependencies": {
    "@flex/config": "workspace:*",
    "@flex/sdk": "workspace:*",
    "@flex/testing": "workspace:*",
    "@vitest/coverage-v8": "<version>",
    "eslint": "<version>",
    "typescript": "<version>",
    "vitest": "<version>"
  }
}
```

Use the same dependency versions as the other gateways. The `exports` entry is only needed if
domains import schemas from the gateway, as the `dvla` and `travel` domains do.

```json title="tsconfig.json"
{
  "extends": "@flex/config/tsconfig.json",
  "include": ["src/**/*.ts", "vitest.config.ts", "gateway.config.ts"]
}
```

```js title="eslint.config.mjs"
export { config as default } from "@flex/config/eslint";
```

`vitest.config.ts` needs the platform setup file and `FLEX_GATEWAY_NAME`; see
[Testing gateways](/flex/gateways/testing/). Run `pnpm install` from the repository root to link
the package.

## 2. Configure the gateway

`gateway.config.ts` calls `defineGateway` once and exports what it returns:

```ts title="gateway.config.ts"
import { defineGateway } from "@flex/service-gateway";
import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

import { ExampleSchema } from "./src/schemas/domain/example";

export const { config, createHandler } = defineGateway({
  name: "example",
  environments: ["development", "staging", "production"],
  access: "private",
  resources: {
    consumerConfig: {
      type: "secret",
      path: "/example/consumer-config-secret-arn",
      env: "FLEX_EXAMPLE_CONSUMER_CONFIG_SECRET_ARN",
      config: z.object({
        apiKey: NonEmptyString,
        apiUrl: NonEmptyString,
      }),
    },
  },
  routes: {
    "GET /v1/example/:id": {
      name: "getExample",
      query: z.object({ queryKey: NonEmptyString }),
      headers: {
        auth: { name: "x-custom-token", required: true },
      },
      response: ExampleSchema,
    },
  },
});
```

The CDK app imports this file at synth time to read `config`. Import only configuration and
schemas here, never runtime code such as clients or AWS SDK calls. See
[Configuration](/flex/gateways/configuration/) for every option.

## 3. Write the handler

`src/gateway.ts` must export the Lambda handler as `handler`. `createHandler` takes a `clients`
factory and one handler for every route key in the configuration; TypeScript rejects a missing one.

```ts title="src/gateway.ts"
import { createRestClient } from "@flex/service-gateway";

import { createHandler } from "../gateway.config";

export const handler = createHandler({
  clients: ({ consumerConfig }) => ({
    api: createRestClient({
      baseUrl: consumerConfig.apiUrl,
      auth: { type: "public" },
    }),
  }),
  routes: {
    "GET /v1/example/:id": ({
      clients: { api },
      resources: { consumerConfig },
      headers: { auth },
      pathParams: { id },
      queryParams: { queryKey },
    }) => {
      return api.get(`/remote/example/${id}`, {
        headers: { Authorization: auth, "X-API-KEY": consumerConfig.apiKey },
        query: { queryKey },
      });
    },
  },
});
```

See [Clients](/flex/gateways/clients/) for the REST and DynamoDB clients and for reshaping a result
with `mapApiResult`.

## 4. Provide the resources

Each resource's `path` names an SSM parameter, `/<env>/flex-param<path>`, which holds the ARN of
the secret, key or role. The CDK app reads these parameters but does not create them, so they and
the resources they point to must exist in each environment before the gateway deploys. A missing
parameter fails the deployment. See [Resources](/flex/gateways/configuration/#resources).

## 5. Test and deploy

1. Write tests for each route in `src/gateway.test.ts`. See
   [Testing gateways](/flex/gateways/testing/).
2. Run `pnpm --filter @flex/<name>-service-gateway test`, then `lint` and `tsc`.
3. Deploy to your personal stage. Personal and PR stages deploy every gateway whatever its
   `environments`. See [Environments](/flex/delivery/environments/).
4. Add a `"gateway"` integration to the domain that needs the upstream and call it from a handler.
   See [Integrations](/flex/domains/integrations/).
5. Add the gateway to the [catalogue](/flex/gateways/catalogue/).
