---
title: Platform handlers
description: How to add a platform handler under platform/domains, wire it into the CDK app, and test it.
---

A platform handler is a function the platform itself runs, rather than one a domain owns: the
[Lambda authorizer](/flex/edge/authorizer/), the
[CloudFront Functions](/flex/edge/cloudfront-functions/), and the
[DVLA secret rotation](/flex/gateways/catalogue/#dvla-secret-rotation) function. Each is a workspace
package under `platform/domains/<name>/`, named `@platform/<name>`.

Service gateways live in the same directory but are not platform handlers in this sense: the
platform discovers and provisions them, so they need none of the wiring below. If the handler's job
is to sit in front of a third-party API, [create a gateway](/flex/gateways/creating-a-gateway/)
instead.

## Create the package

```text
platform/domains/<name>/
├── src/
│   ├── handler.ts
│   └── handler.test.ts
├── eslint.config.mjs
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

```json title="package.json"
{
  "name": "@platform/<name>",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "tsc": "tsc --noEmit",
    "lint": "eslint --max-warnings=0 .",
    "test": "vitest --passWithNoTests"
  },
  "dependencies": {
    "@flex/logging": "workspace:*"
  },
  "devDependencies": {
    "@flex/config": "workspace:*",
    "@flex/testing": "workspace:*",
    "@types/aws-lambda": "<version>",
    "@types/node": "<version>",
    "eslint": "<version>",
    "typescript": "<version>",
    "vitest": "<version>"
  }
}
```

Add what the handler needs, such as `@flex/telemetry`, `@middy/core` or an AWS SDK client, at the
versions the other packages use. A CloudFront Function cannot use `@flex/logging` or most other
dependencies; see [How the functions are built](/flex/edge/cloudfront-functions/#how-the-functions-are-built).

`tsconfig.json` extends `@flex/config/tsconfig.json` and `eslint.config.mjs` re-exports
`@flex/config/eslint`, as in every package. Run `pnpm install` from the repository root to link the
package.

## Wire it into the CDK app

Nothing discovers a platform handler. Add it to a stack in
[`platform/infra/flex`](https://github.com/govuk-once/flex/tree/main/platform/infra/flex/src) and
attach it to its trigger.

1. Pick the stack that matches the handler's lifetime. See
   [Infrastructure](/flex/infrastructure/overview/) for what each stack holds.

   | Stack | Holds | Example |
   | --- | --- | --- |
   | `<env>-FlexCore` | One copy per persistent environment | DVLA secret rotation |
   | `<stage>-FlexPlatform` | One copy per stage, regional | The authorizer |
   | `<stage>-FlexGlobal` | One copy per stage, in `us-east-1` | The CloudFront Functions |

2. Point a construct at the handler with `getPlatformEntry(<name>, <path under src>)`. A Lambda uses
   one of the [Lambda constructs](/flex/infrastructure/lambda-constructs/); a CloudFront Function
   uses `FlexCloudfrontFunction`.

   ```ts
   import { FlexPrivateEgressFunction } from "../constructs/lambda/flex-private-egress-function";
   import { getPlatformEntry } from "../utils/getEntry";

   const authorizerFn = new FlexPrivateEgressFunction(this, "AuthorizerFunction", {
     entry: getPlatformEntry("auth", "handler.ts"),
     timeout: Duration.seconds(10),
     environment: { USERPOOL_ID: userPoolId, CLIENT_ID: clientId, JWKS_URI: jwksUri },
     privateEgressSg,
     vpc,
     criticalAction,
     warningAction,
   });
   ```

3. Attach it to its trigger: an API Gateway authorizer, a CloudFront function association, a
   Secrets Manager rotation schedule, and so on.
4. Grant it only the permissions it needs, and export anything another stack must read through SSM.
5. Synth, then deploy to your personal stage. See [Environments](/flex/delivery/environments/).

The Lambda constructs bundle the entry with esbuild and expect the handler to be exported as
`handler`.

## Test it

Each handler has unit tests next to it in `src/`, using the `platform` fixture from `@flex/testing`.
See [`@flex/testing`](/flex/reference/flex-testing/) for every fixture.

If the handler calls AWS or makes HTTP requests, add the platform setup file, which blocks real
network access and resets the AWS mocks and Secrets Manager cache between tests:

```ts title="vitest.config.ts"
import { config } from "@flex/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  config,
  defineConfig({
    test: {
      setupFiles: ["@flex/testing/setup/platform"],
      env: { AWS_REGION: "eu-west-2" },
    },
  }),
);
```

A CloudFront Function has no dependencies to stub and can use the shared configuration as it is:
`export { config as default } from "@flex/config/vitest";`.

### Lambda authorizer

Build the event with `platform.authorizerEvent`, which defaults to a valid token, and compare with
`platform.authorizerResult(effect, resource, options)`. Stub the JWKS fetch with the `http` fixture.

```ts
import { it, publicJWKS, validJwtUsername } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./handler";

describe("authorizer", () => {
  const cognitoUrl = "https://cognito-idp.eu-west-2.amazonaws.com";
  const userPoolId = "eu-west-2_testUserPoolId";
  const jwksPath = `/${userPoolId}/.well-known/jwks.json`;

  it.beforeEach(({ env }) => {
    env.set({
      USERPOOL_ID: userPoolId,
      CLIENT_ID: "testClientId",
      JWKS_URI: `${cognitoUrl}${jwksPath}`,
    });
  });

  it("allows a valid token", async ({ http, platform }) => {
    http.url(cognitoUrl).get(jwksPath).reply(200, publicJWKS);

    const result = await handler(platform.authorizerEvent(), platform.context());

    expect(result).toStrictEqual(
      platform.authorizerResult("Allow", "*", {
        context: { pairwiseId: validJwtUsername },
      }),
    );
  });

  it("denies an invalid token", async ({ platform }) => {
    const event = platform.authorizerEvent({ authorizationToken: "Bearer invalid" });

    const result = await handler(event, platform.context());

    expect(result).toStrictEqual(platform.authorizerResult("Deny", event.methodArn));
  });
});
```

`@flex/testing` also exports `expiredJwt`, `invalidJwt` and `jwtMissingUsername` for the failure
cases.

### CloudFront Function

Build the event with `platform.cloudFrontEvent.<method>(uri, options)`. A forwarded request is the
event's own `request`; a response compares with `platform.cloudFrontResult(status, options)`.
CloudFront Functions are synchronous, so there is nothing to await.

```ts
import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./handler";

describe("viewer request", () => {
  // Structurally valid: three segments, JSON header and body. The signature is not checked.
  const jwt = "eyJoZWxsbyI6ICJ3b3JsZCJ9.eyJoZWxsbyI6ICJUb20ifQ==.c2lnbmF0dXJl"; // pragma: allowlist secret

  it("forwards a request with a well-formed token", ({ platform }) => {
    const event = platform.cloudFrontEvent.get("/example", {
      headers: { authorization: `Bearer ${jwt}` },
    });

    expect(handler(event)).toBe(event.request);
  });

  it("rejects a request without a token", ({ platform }) => {
    const result = handler(platform.cloudFrontEvent.get("/example"));

    expect(result).toStrictEqual(
      platform.cloudFrontResult(401, {
        body: { message: "Unauthorized", type: "auth_error" },
        headers: {
          "content-type": "application/json",
          "x-rejected-by": "cloudfront-function",
        },
      }),
    );
  });
});
```

### End-to-end

Behaviour that only shows once deployed, such as what CloudFront returns for a rejected token, is
covered by the platform E2E suite in `tests/e2e/src/platform/`. See
[E2E tests](/flex/delivery/e2e-tests/).

Run a package's unit tests with `pnpm --filter @platform/<name> test`.
