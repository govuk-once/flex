---
title: Your first domain
description: Build a domain with a handler, a gateway integration, then test it, deploy it and call it.
sidebar:
  order: 2
---

By the end of this page you should have a domain with one public route that calls the UDP service gateway. You will have unit tests, an E2E test, a personal deployment and a token to call it by hand.

:::caution[AWS access]
Steps 1 to 5 need no AWS access. **Steps 6 onward do.**

If you don't have access yet, stop after step 5 and see [Get started developing on GOV.UK](https://docs.publishing.service.gov.uk/manual/get-started.html#6-get-permissions-for-aws-github-and-other-third-party-services) for details on requesting access.
:::

This page keeps examples small and links to the [Domains](/flex/domains/overview/) section for the full detail. For how requests flow through the platform, see [How Flex works](/flex/introduction/how-flex-works/) as the source of truth.

## 1. Check your setup

Complete [Environment setup](/flex/getting-started/environment-setup/), then confirm the repository works:

```bash
pnpm install
pre-commit install
pnpm test
```

## 2. Create the package

A domain is a workspace package under `domains/`. Create `domains/hello/` with the five files below. They are the same for every domain, apart from the package name.

:::tip[Topics domain]
[`domains/topics`](https://github.com/govuk-once/flex/tree/main/domains/topics) is a small, real domain to compare against.
:::

### package.json

```json title="domains/hello/package.json"
{
  "name": "@flex/hello-domain",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "tsc": "tsc --noEmit",
    "lint": "eslint --max-warnings=0 .",
    "lint:fix": "eslint --fix .",
    "test": "vitest --passWithNoTests",
    "test:e2e": "vitest --passWithNoTests --config vitest.e2e.config.ts"
  },
  "dependencies": {
    "@flex/sdk": "workspace:*",
    "@flex/utils": "workspace:*",
    "http-errors": "2.0.1",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@flex/config": "workspace:*",
    "@flex/testing": "workspace:*",
    "@types/http-errors": "2.0.5",
    "eslint": "10.7.0",
    "typescript": "6.0.3",
    "vitest": "4.1.10"
  }
}
```

The `test:e2e` script matters: CI discovers domains to run E2E tests for by looking for it.

### tsconfig

```json title="domains/hello/tsconfig.json"
{
  "extends": "@flex/config/tsconfig.json",
  "include": [
    "src/**/*.ts",
    "e2e/**/*.ts",
    "vitest.config.ts",
    "vitest.e2e.config.ts",
    "domain.config.ts"
  ],
  "compilerOptions": {
    "paths": {
      "@domain": ["./domain.config.ts"]
    }
  }
}
```

`@domain` is a path alias to your `domain.config.ts`, so handlers can import `route` from it.

### eslint

```js title="domains/hello/eslint.config.mjs"
import { config } from "@flex/config/eslint";

export default config;
```

### vitest

```ts title="domains/hello/vitest.config.ts"
import { config } from "@flex/config/vitest";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, "e2e/**"],
      setupFiles: ["@flex/testing/setup/sdk"],
      env: {
        AWS_REGION: "eu-west-2",
        AWS_ACCESS_KEY_ID: "test", // pragma: allowlist secret
        AWS_SECRET_ACCESS_KEY: "test", // pragma: allowlist secret
        // One entry per resource the domain declares. Step 4 adds this one.
        privateGatewayUrl: "https://execute-api.eu-west-2.amazonaws.com",
      },
    },
  }),
);
```

### vitest e2e

```ts title="domains/hello/vitest.e2e.config.ts"
import { e2eConfig } from "@flex/config/vitest/e2e";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  e2eConfig,
  defineConfig({
    test: {
      testTimeout: 40_000,
    },
  }),
);
```

### README.md

Add a short `README.md` saying what the domain does.

See [Contributing to the docs](/flex/reference/contributing-to-docs/) for the template.

### Install

Then install, so the workspace picks up the new package:

```bash
pnpm install
```

Nothing else needs registering. The platform finds `domains/*/domain.config.ts` at deploy time, and CI finds domains with a `test:e2e` script.

## 3. Declare a route and write a handler

`domain.config.ts` is the contract. This is the smallest useful version, with one public route:

```ts title="domains/hello/domain.config.ts"
import { domain } from "@flex/sdk";
import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

const GreetingResponseSchema = z.object({
  message: NonEmptyString,
  topicCount: z.number().optional(),
});

export const { config, route, routeContext } = domain({
  name: "hello",
  environments: ["development"],
  common: { access: "isolated" },
  routes: {
    v1: {
      "/greeting": {
        GET: {
          public: {
            name: "get-greeting",
            response: GreetingResponseSchema,
          },
        },
      },
    },
  },
});
```

### Config options

| Option         | Purpose                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------ |
| `name`         | The name of your domain                                                                          |
| `environments` | Where the domain deploys. Start with `development`, add others when ready to promote             |
| `common`       | Defaults for every route (`access`, `logLevel`, `function`, `headers`). Routes can override them |
| `routes`       | API endpoints your domain exposes                                                                |

### Handler

The handler file location comes from the route. The file for `GET /v1/greeting` with `public` goes at `src/handlers/v1/greeting/get.ts`.

A `private` route adds a `.private` suffix, for example `get.private.ts`.

```ts title="domains/hello/src/handlers/v1/greeting/get.ts"
import { route } from "@domain";

export const handler = route("GET /v1/greeting", async (context) => {
  const { auth, logger } = context;

  logger.info("Greeting user", { userId: auth.userId });

  return { status: 200, data: { message: "Hello" } };
});
```

| Component     | Purpose                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `@domain`     | Path alias to your `domain.config.ts`, defined in `tsconfig.json`.                                               |
| `context`     | Usually destructured. Typed from the route's config, so only what you declare is available.                      |
| `auth.userId` | User's pseudonymous id. Always present on public routes. More info in [Domains](/flex/domains/overview/) section |

As a handler grows, you can split it into helper functions. Pass the values they need as arguments, or have them read the route's context with `routeContext`, the third thing `domain.config.ts` exports. See [Route context](/flex/domains/route-context/).

## 4. Call a gateway

Domains reach external data through service gateways, declared as **integrations**.

### Update domain config

Add a resource, an integration and wire both into the route. Highlighted lines are keyed and explained below.

```ts title="domain.config.ts" ins={"1":1-8} ins={"2":10-16} ins={"3":17-24} ins={"4":31-32}
const SelectedTopicsResponseSchema = z.object({
  topics: z.object({
    selectedTopics: z.array(
      z.object({ id: NonEmptyString, title: NonEmptyString }),
    ),
  }),
});

export const { config, route, routeContext } = domain({
  resources: {
    privateGatewayUrl: {
      type: "ssm",
      path: "/flex/apigw/private/gateway-url",
      scope: "stage",
    },
  },
  integrations: {
    udpGetTopics: {
      type: "gateway",
      target: "udp",
      route: "GET /v1/topics",
      response: SelectedTopicsResponseSchema,
    },
  },
  routes: {
    v1: {
      "/greeting": {
        GET: {
          public: {
            name: "get-greeting",
            resources: ["privateGatewayUrl"],
            integrations: ["udpGetTopics"],
            response: GreetingResponseSchema,
          },
        },
      },
    },
  },
});
```

| Key | Purpose                                                              |
| --- | -------------------------------------------------------------------- |
| `1` | Schema for integration - Can be abstracted later                     |
| `2` | Resource definition - Flex gateway URL required to call integrations |
| `3` | Integrations definition - List all domain integrations               |
| `4` | Route integration definition - For use by handler                    |

### Update handler

Call it from the handler, and decide what to do with upstream errors:

```ts title="domains/hello/src/handlers/v1/greeting/get.ts" ins="integrations," ins={7-9} ins={27,27}
import { route } from "@domain";
import createHttpError from "http-errors";

export const handler = route(
  "GET /v1/greeting",
  async ({ auth, integrations, logger }) => {
    const result = await integrations.udpGetTopics({
      headers: { "requesting-service-user-id": auth.userId },
    });

    if (!result.ok) {
      const { status } = result.error;

      // A user with no topics yet is not an error
      if (status === 404) {
        return { status: 200, data: { message: "Hello", topicCount: 0 } };
      }

      logger.error("Upstream request failed", { status });
      throw new createHttpError.BadGateway();
    }

    return {
      status: 200,
      data: {
        message: "Hello",
        topicCount: result.data.topics.selectedTopics.length,
      },
    };
  },
);
```

The integration name in the handler must match the key in the config, and its types come from the schemas you declared.

Private gateway routes carry no user identity of their own, so you pass the user id in a header.

If the gateway route you need doesn't exist, adding it is platform work. See [Current limits](/flex/introduction/current-limits/).

Nothing checks a gateway integration's route before you call it, so compare it with the gateway's config in [`platform/domains/udp`](https://github.com/govuk-once/flex/tree/main/platform/domains/udp). `pnpm validate:integrations` only checks integrations to other domains.

More in [Calling other domains and gateways](/flex/domains/calling-other-domains/).

## 5. Write unit tests

Unit tests run the full SDK pipeline in process: validation, context building and response mapping. The `http` fixture intercepts outbound gateway calls, and `sdk` builds the API Gateway event and the Lambda context.

See [Testing](/flex/domains/testing/) for more detailed information.

### Handler test file

```ts title="domains/hello/src/handlers/v1/greeting/get.test.ts"
import { createUserId, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./get";

const userId = createUserId("test-user");

describe("GET /v1/greeting", () => {
  it("returns the expected response shape", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get("/topics", { headers: { "requesting-service-user-id": userId } })
      .reply(200, {
        topics: { selectedTopics: [{ id: "topic-1", title: "Topic One" }] },
      });

    const result = await handler(
      sdk.event.get("/greeting", { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({
      message: "Hello",
      topicCount: 1,
    });
  });

  it("returns 502 when the gateway fails", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get("/topics", { headers: { "requesting-service-user-id": userId } })
      .reply(500, {});

    const result = await handler(
      sdk.event.get("/greeting", { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
  });
});
```

Run tests, should start in `watch` mode:

```bash
# Test
pnpm --filter @flex/hello-domain test
```

Run Typecheck and lint:

```bash
# Typecheck
pnpm --filter @flex/hello-domain tsc

# Lint
pnpm --filter @flex/hello-domain lint
```

## ❗️ AWS access required

:::caution
**Everything from here on needs AWS access.**

Sign in with the GDS CLI first.
:::

## 6. Deploy your personal stack

Your stack is named after `$USER` and is isolated from the shared environments.

```bash
# Deploy everything
pnpm run deploy

# Only your domain
domain=hello pnpm run deploy
```

Even with `domain=hello`, the platform and global stacks are still part of the deployment.

See [Deploying and verifying](/flex/domains/deploying/) for more detailed information.

## 7. Run the E2E test

E2E tests call your deployed stack over real HTTP. Add `e2e/hello.test.ts`:

```ts title="domains/hello/e2e/hello.test.ts"
import { isDomainDeployed } from "@flex/sdk";
import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

import { config } from "../domain.config";

describe.runIf(isDomainDeployed(config))("Hello domain", () => {
  it("rejects unauthenticated requests", async ({ cloudfront }) => {
    const result = await cloudfront.client.get("/hello/v1/greeting");

    expect(result.status).toBe(401);
  });

  it("returns 200 for an authenticated user", async ({
    cloudfront,
    authHeader,
  }) => {
    const result = await cloudfront.client.get("/hello/v1/greeting", {
      headers: authHeader,
    });

    expect(result.status).toBe(200);
  });
});
```

Then run:

```bash
pnpm --filter @flex/hello-domain test:e2e
```

- The E2E setup finds your stack from its CloudFormation outputs and fetches its own token. You don't need to export one.
- `authHeader` is a ready-made headers object with a valid `Authorization: Bearer <token>` and the `x-flex-e2e-bypass` header, which skips WAF rate limiting during test runs. Use it for authenticated requests.
- CI runs the `test:e2e` script of every domain that has one, against each pull request's ephemeral environment and after each deploy to `development` and `staging`. It isn't a required check and doesn't block promotion, so check the result yourself.

## 8. Make requests by hand

Your API URL is `https://<stage>.development.bl.once.service.gov.uk`, where `<stage>` is your personal stage name (see [Environment variables](/flex/getting-started/environment-setup/#environment-variables)).

It is also the `FlexApiUrl` output of your `<stage>-FlexGlobal` stack in `us-east-1`. This command works out your stage name the same way the deploy does (see [`sanitiseStageName`](https://github.com/govuk-once/flex/blob/main/libs/utils/src/infra/index.ts)), then reads the output:

```bash
STAGE=$(printf '%s' "$USER" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9-' | cut -c1-12)

aws cloudformation describe-stacks \
  --region us-east-1 \
  --stack-name "${STAGE}-FlexGlobal" \
  --query "Stacks[0].Outputs[?OutputKey=='FlexApiUrl'].OutputValue" \
  --output text
```

Generate a token. The script prints some progress text and then the token, so copy just the token:

```bash
pnpm jwt
export TOKEN=<token>
```

Call the route using your preferred method (Postman/Bruno/curl)

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "<FlexApiUrl>/app/hello/v1/greeting"
```

## 9. Open a pull request

- Title it with the Jira key followed by a [Conventional Commits](https://github.com/govuk-once/flex/blob/main/.github/CONTRIBUTING.md) message, such as `FLEX-123 feat(hello): add greeting route`. Pull requests are squash merged, so the title becomes the commit on `main` and sets the next release version. If there is no Jira ticket, use `FLEX-000`.
- Use the pull request template and link the Jira ticket in the description.
- `CODEOWNERS` sends every pull request under `domains/` to the Flex team for review.
