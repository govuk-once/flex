# Platform Development Guide

Guide for developers maintaining FLEX platform infrastructure and shared libraries.

---

## Overview

| Area                     | Description                                                         |
| ------------------------ | ------------------------------------------------------------------- |
| Packages                 | Shared utilities consumed by developers working on FLEX             |
| Service Gateways         | Lambdas proxying to remote third-party APIs                         |
| Platform Domain Handlers | Platform domain functions (Authentication, viewer-request-cff, etc) |
| Platform Infrastructure  | CDK stacks, constructs and deployment configuration                 |
| Developer Experience     | Tooling, utilities and documentation                                |

---

## Prerequisites

Complete the [Environment Setup](/docs/environment-setup.md) before starting platform development.

Platform developers additionally need:

- Permission to assume roles for deploying to persistent environments (`development`, `staging`, `production`)

---

## Package Development

Packages in `libs/*` provide shared functionality for all developers working on FLEX.

### Directory Structure

```text
libs/<package>/
├── src/
│   ├── index.ts
│   └── ...
├── eslint.config.mjs
├── package.json
├── README.md
├── tsconfig.json
└── vitest.config.ts
```

### Creating a New Package

1. Update `package.json`:

```json
{
  "name": "@flex/<package>",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "eslint --max-warnings=0 .",
    "test": "vitest"
  },
  "devDependencies": {
    "@flex/config": "workspace:*",
    "@flex/testing": "workspace:*",
    "eslint": "<version>",
    "typescript": "<version>",
    "vitest": "<version>"
  }
}
```

2. Create configuration files and extend all shared config:
   `eslint.config.mjs`

```javascript
export { config as default } from "@flex/config/eslint";
```

`tsconfig.json`

```json
{
  "extends": "@flex/config/tsconfig.json",
  "include": ["src/**/*.ts", "vitest.config.ts"]
}
```

`vitest.config.ts`

```typescript
export { config as default } from "@flex/config/vitest";
```

3. Create entry point at `src/index.ts`
4. Create `README.md` using the [FLEX Platform SDK template](/docs/documentation-guide.md#flex-platform-sdk)
5. Run `pnpm install` from the repository root to link the new package and install its dependencies

### Export Conventions

- Export modules and types from `src/index.ts`
- Always keep the `README.md` up to date for discoverability

### Multiple Entry Points

Packages can have multiple exports (e.g., `@flex/testing`):

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./other": "./src/other/index.ts"
  }
}
```

Consumers import via:

```typescript
import { it } from "@flex/testing";
import { createApi } from "@flex/testing/e2e";
```

---

## Platform Domain Handler Development

Platform domain handlers in `platform/domains/*` provide cross-cutting functionality.

### Directory Structure

```text
platform/domains/<domain>/
├── src/
│   ├── handler.ts
│   ├── handler.test.ts
│   └── ...
├── eslint.config.mjs
├── package.json
├── README.md
├── tsconfig.json
└── vitest.config.ts
```

### Creating a Platform Domain Handler

1. Update `package.json`:

```json
{
  "name": "@platform/<domain>",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "lint": "eslint --max-warnings=0 .",
    "test": "vitest"
  },
  "dependencies": {
    "@flex/logging": "workspace:*",
    "http-errors": "<version>",
    "zod": "<version>"
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

2. Implement the handler using the [handler patterns](/docs/developer-reference.md#handler-patterns) from the Developer Reference
3. Add tests using [@flex/testing](/libs/testing/README.md)
4. Create `README.md` using the [FLEX Platform Domain template](/docs/documentation-guide.md#flex-platform-domain)
5. Add the resources to `@platform/flex` (see [Adding a Platform Handler to Infrastructure](#adding-a-platform-handler-to-infrastructure))

> If the handler needs to act as an ACL in front of a remote third-party API then follow the [Service Gateway Development](#service-gateway-development) steps instead.

---

## Service Gateway Development

Service gateways in `platform/domains/*` are Lambdas that sit between FLEX and a remote third-party API.

They're built with [`@flex/service-gateway`](/libs/service-gateway/README.md) and live alongside platform domain handlers in `platform/domains/*`, with all gateway configuration defined in the `gateway.config.ts` file.

### Directory Structure

```text
platform/domains/<name>/
├── src/
│   ├── gateway.ts
│   ├── gateway.test.ts
│   └── schemas/
│       ├── domain/
│       └── remote/
├── eslint.config.mjs
├── gateway.config.ts
├── package.json
├── README.md
├── tsconfig.json
└── vitest.config.ts
```

### Creating a Service Gateway

1. Update `package.json`:

```json
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
    "@flex/logging": "workspace:*",
    "@flex/service-gateway": "workspace:*",
    "@flex/utils": "workspace:*",
    "zod": "<version>"
  },
  "devDependencies": {
    "@flex/config": "workspace:*",
    "@flex/sdk": "workspace:*",
    "@flex/testing": "workspace:*",
    "eslint": "<version>",
    "typescript": "<version>",
    "vitest": "<version>"
  }
}
```

1. Define `gateway.config.ts` at the workspace root and create a `defineGateway` instance. See [`defineGateway`](/libs/service-gateway/README.md#definegateway) for the full configuration reference:

```ts
import { defineGateway } from "@flex/service-gateway";
import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const { config, createHandler } = defineGateway({
  name: "example",
  environments: ["development", "staging", "production"],
  access: "private",
  resources: {
    consumerConfig: {
      type: "secret",
      path: "/example/consumer-config-secret-arn",
      env: "FLEX_EXAMPLE_CONSUMER_CONFIG_SECRET_ARN",
      scope: "environment",
      config: z.object({
        apiKey: NonEmptyString,
        apiUrl: NonEmptyString,
        // ...
      }),
    },
  },
  routes: {
    "GET /v1/example/path": {
      name: "getExample",
      headers: {
        auth: { name: "x-custom-auth", required: true },
      },
      // ...
    },
  },
});
```

3. Define `src/gateway.ts` and create a `createHandler` instance, exported from `gateway.config.ts`. See [Handler Context](/libs/service-gateway/README.md#handler-context) and [Handler Result](/libs/service-gateway/README.md#handler-result) for what each route handler receives and must return:

```ts
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
    "GET /v1/example/path": ({ clients: { api }, headers: { auth } }) => {
      return api.get("/some/third-party/path", {
        headers: { Authorization: auth },
      });
    },
  },
});
```

4. Add tests for the gateway handlers using `@flex/testing` (see [Testing Service Gateways](#testing-service-gateways))
5. Create `README.md` using the [FLEX Platform Domain template](/docs/documentation-guide.md#flex-platform-domain)
6. Infrastructure automatically discovers all service gateways, see [Service Gateway Infrastructure](#service-gateway-infrastructure)

### Calling Remote APIs

Use `createRestClient` from `@flex/service-gateway` to build an HTTP client for the remote third-party API. Each client is built once per invocation and is accessible via the handler context:

```ts
import { createRestClient } from "@flex/service-gateway";

import { createHandler } from "../gateway.config";

export const handler = createHandler({
  clients: ({ consumerConfig }) => {
    const correlationId = "example-uuid";

    return {
      api: createRestClient({
        baseUrl: consumerConfig.apiUrl,
        auth: { type: "public" },
        headers: { "X-Correlation-Id": correlationId },
      }),
      otherApi: createRestClient({
        baseUrl: consumerConfig.otherApiUrl,
        auth: { type: "sigv4" },
        headers: { "X-Correlation-Id": correlationId },
      }),
    };
  },
  routes: {
    "POST /v1/example/path": ({
      clients: { api, otherApi },
      headers: { auth },
    }) => {
      // Any client can be called if needed
      otherApi.post("/some/path", { body: { key: "value" } });

      return api.post("/remote/path", {
        headers: { Authorization: auth },
        body: { linkingId: "example" },
      });
    },
  },
});
```

Each client can then be accessed via `clients` and can be invoked within any route handler. See [Clients](/libs/service-gateway/README.md#clients) for all supported clients.

### Service Gateway Infrastructure

Every gateway configuration file (`platform/domains/*/gateway.config.ts`) is discovered and deployed automatically, no manual registration is needed in `@platform/flex`. Each gateway is provisioned as a single proxy route (`ANY /gateways/<name>/{proxy+}`) on the private API Gateway, determined by the access set in its configuration.

From a domain handler's perspective, calling a service gateway works the same way as calling any other domain. The only difference is in the integration definition by specifying the type:

```ts
integrations: {
  gatewayIntegration: {
    type: "gateway",
    target: "example",
    route: "GET /v1/example/path",
    response: GetExamplePathResponseSchema,
  },
  domainIntegration: {
    type: "domain",
    target: "example",
    route: "GET /v1/example/path",
    response: GetExamplePathResponseSchema,
  },
},
```

For more in-depth integration patterns, see [Integrations](/libs/sdk/README.md#integrations) and also [With Integrations](/docs/domain-development.md#with-integrations) for a working example.

---

## Platform Infrastructure Development

Platform infrastructure code in `platform/infra/*` defines CDK stacks and constructs.

### Directory Structure

```text
platform/infra/<name>/
├── scripts/
├── src/
│   ├── app.ts
│   ├── stack.ts
│   └── ...
├── cdk.json
├── checkov.yaml
├── eslint.config.mjs
├── package.json
├── README.md
└── tsconfig.json
```

### App Entry Point

```typescript
import * as cdk from "aws-cdk-lib";
import { getEnvConfig } from "@flex/utils";

import { ExampleStack } from "./stack";

const { stage } = getEnvConfig();

const app = new cdk.App();

new ExampleStack(app, `${stage}-ExampleStack`);
```

### Stack Definition

All stacks extend `GovUkOnceStack` for consistent GDS-compliant tagging:

```typescript
import type { Construct } from "constructs";

import { BaseStack } from "../base";

export class ExampleStack extends BaseStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "",
        Source: "https://github.com/govuk-once/flex",
      },
      env: {
        region: "eu-west-2",
      },
    });

    // Define resources, call methods, etc
  }
}
```

### Stack Naming Convention

Use `getEnvConfig()` and prefix your stack with either the stage or env. Use env in the case where you want to reference a persistent environment only e.g the VPC stack.

```typescript
import { getEnvConfig } from "@flex/utils";

const { env, stage } = getEnvConfig();

new ExampleStack(app, `${stage}-ExampleStack`);
// "development-ExampleStack", "pr-123-ExampleStack", etc.
```

### Environment Configuration

Use `getEnvConfig()` to access environment details:

```typescript
import { getEnvConfig } from "@flex/utils";

const { stage, environment, persistent } = getEnvConfig();

if (persistent) {
  // Create resources for persistent environments
}
```

---

## Cross-Stack Communication

Stacks resolve values via SSM parameters. `@platform/core` exports infrastructure references that `@platform/flex` consumes.

### Exporting to SSM

Use the export functions from `@platform/core/outputs`:

```typescript
import {
  exportSecurityGroupToSsm,
  exportStringToSsm,
  exportVpcToSsm,
} from "@platform/core/outputs";

// Export VPC
exportVpcToSsm(this, vpc, "/flex-core/vpc");

// Export security group
exportSecurityGroupToSsm(
  this,
  securityGroup,
  "/flex-core/security-group/private-egress",
);

// Export arbitrary string
exportStringToSsm(this, cacheEndpoint, "/flex-core/cache/endpoint");
```

### Importing from SSM

```typescript
import {
  importSecurityGroupFromSsm,
  importStringFromSsm,
  importVpcFromSsm,
} from "@platform/core/outputs";

const vpc = importVpcFromSsm(this, "/flex-core/vpc");

const privateEgressSg = importSecurityGroupFromSsm(
  this,
  "/flex-core/security-group/private-egress",
);

const cacheEndpoint = importStringFromSsm(this, "/flex-core/cache/endpoint");
```

### SSM Path Naming Convention

| Pattern                | Example                                                 | Purpose                |
| ---------------------- | ------------------------------------------------------- | ---------------------- |
| `/<env>/flex-core/*`   | `/development/flex-core/vpc`                            | Core infrastructure    |
| `/<env>/flex-param/*`  | `/development/flex-param/auth/user-pool-id`             | Application parameters |
| `/<env>/flex-secret/*` | `/development/flex-secret/udp/notification-hash-secret` | Secret references      |

The `<env>` prefix is added automatically based on the deployment stage.

---

## Lambda Constructs

See the [Developer Reference](/docs/developer-reference.md#lambda-constructs) for choosing a Lambda construct, creating Lambda functions and entry point helpers.

---

## Creating Constructs

Encapsulate related resources in constructs for reusability.

### Construct Pattern

```typescript
import type { ISecurityGroup, IVpc } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { ExampleResource } from "./path/to/resource";

export interface ExampleConstructProps {
  vpc: IVpc;
  securityGroup: ISecurityGroup;
}

export class ExampleConstruct extends Construct {
  public readonly resource: SomeResource;

  constructor(scope: Construct, id: string, props: ExampleConstructProps) {
    super(scope, id);

    this.resource = new ExampleResource(this, "ExampleResource", {
      vpc: props.vpc,
      securityGroups: [props.securityGroup],
    });
  }
}
```

### Domain Construct

See [Route Provisioning](/docs/developer-reference.md#route-provisioning) to see domain construct patterns and stack instantiation.

---

## Adding a Platform Handler to Infrastructure

After creating a platform handler, configure the resources in `@platform/flex`:

1. Create or update a construct in `platform/infra/flex/src/constructs/`
2. Use `getPlatformEntry` to reference the handler:

```typescript
import { FlexPublicFunction } from "./flex-public-function";
import { getPlatformEntry } from "../utils/getEntry";

const exampleHandler = new FlexPublicFunction(this, "ExampleFunction", {
  entry: getPlatformEntry("domain", "handler.ts"),
  domain: "domain",
});
```

3. Attach to the appropriate trigger (API Gateway, CloudFront, etc.)
4. Instantiate the construct in `stack.ts`

> Service gateways do not need this step as they're automatically provisioned via [`createServiceGateway`](/platform/infra/flex/src/utils/create-service-gateway.ts), see [Service Gateway Infrastructure](#service-gateway-infrastructure)

---

## Testing

See [@flex/testing](/libs/testing/README.md) for the complete list of available fixtures.

Platform domain handlers and service gateways share the same `platform` fixture. Each workspace needs to configure the required setup files in `vitest.config.ts`: ["@flex/testing/setup/platform"] configured in their `vitest.config.ts`. This registers the necessary mocks and overrides for the `platform` fixture.

For Service gateway test suites you must set `FLEX_GATEWAY_NAME` with the gateway's name in `vitest.config.ts` as the `platform.gatewayEvent` fixture uses it to build the correct request path `/gateways/<name>/...`:

```ts
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
        FLEX_GATEWAY_NAME: "example",
        // ...
      },
    },
  }),
);
```

### Testing Platform Domain Handlers

Create a test file at `platform/domains/<handler>/src/handler.test.ts`.

You must use the correct platform fixtures for each handler type.

#### Lambda Authorizer

Platform fixtures to use:

- `platform.authorizerEvent`
- `platform.authorizerResult`
- `platform.context`

```ts
import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./handler";

describe("handler", () => {
  it("allow request with a valid token", async ({ platform }) => {
    const result = await handler(
      platform.authorizerEvent(),
      platform.context(),
    );

    expect(result).toStrictEqual(platform.authorizerResult("Allow", "*"));
  });

  it("deny request with an invalid token", async ({ platform }) => {
    const result = await handler(
      platform.authorizerEvent({ authorizationToken: "Bearer invalid" }),
      platform.context(),
    );

    expect(result).toStrictEqual(platform.authorizerResult("Deny", "*"));
  });
});
```

#### CloudFront Function

Platform fixtures to use:

- `platform.cloudFrontEvent`
- `platform.cloudFrontResult`
- `platform.context`

```ts
import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./handler";

describe("handler", () => {
  const uri = "/example";

  it("passes through a request with the expected headers", ({ platform }) => {
    const event = platform.cloudFrontEvent.get(uri, {
      headers: { authorization: "Bearer test.valid.token" },
    });

    const result = handler(event);

    expect(result).toStrictEqual(event.request);
  });

  it("rejects a request missing a required header", ({ platform }) => {
    const event = platform.cloudFrontEvent.get(uri);

    const result = handler(event);

    expect(result).toStrictEqual(
      platform.cloudFrontResult(401, { body: { message: "Unauthorized" } }),
    );
  });
});
```

### Testing Service Gateways

Create a test file at `platform/domains/<name>/src/gateway.test.ts`.

Platform fixtures to use:

- `platform.gatewayEvent`
- `platform.gatewayResult`
- `platform.context`

```ts
import type { HttpFixture } from "@flex/testing";
import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./gateway";

const mockSecretArn =
  "arn:aws:secretsmanager:eu-west-2:123456789012:secret:example-consumer";

const mockConsumerConfig = {
  apiKey: "test-api-key", // pragma: allowlist secret
  apiUrl: "https://example-api.test",
};

const stubConsumerConfig = (http: HttpFixture) =>
  http
    .url("https://secretsmanager.eu-west-2.amazonaws.com")
    .post("/")
    .reply(200, {
      ARN: mockSecretArn,
      Name: "example-consumer",
      SecretString: JSON.stringify(mockConsumerConfig),
    });

describe("Example Service Gateway", () => {
  it.beforeEach(({ env }) => {
    env.set({ FLEX_EXAMPLE_CONSUMER_CONFIG_SECRET_ARN: mockSecretArn });
  });

  describe("GET /v1/example/path", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns the remote response", async ({ http, platform }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .get("/some/third-party/path")
        .reply(200, { message: "ok" });

      const result = await handler(
        platform.gatewayEvent.get("/v1/example/path", {
          headers: { "x-custom-auth": "test-token" },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: { message: "ok" } }),
      );
    });
  });
});
```

### E2E Tests

Create a test file at `tests/e2e/src/platform/<handler>.test.ts`.

Using the `cloudfront` fixture:

```typescript
import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

it("example", async ({ cloudfront }) => {
  const result = await cloudfront.client.get("/example", {
    headers: {
      Authorization: "Bearer test.valid.token",
    },
  });

  expect(result.headers.get("x-rejected-by")).toBeUndefined();
  expect(result).toMatchObject({
    // Expected result
  });
});
```

> Service gateways are only accessible via the private API, so E2E coverage is handled by the `tests/e2e/src/platform/private-gateway.test.ts` suite.

### Running Tests

```bash
# Run tests for a package or platform domain
pnpm --filter @flex/<package> test
pnpm --filter @platform/<domain> test

# Run tests with coverage
pnpm --filter @flex/<package> test --coverage
pnpm --filter @platform/<domain> test --coverage

# Run tests in watch mode
pnpm --filter @flex/<package> test --watch
pnpm --filter @platform/<domain> test --watch

# Run E2E tests against your personal environment
pnpm --filter @flex/e2e test:e2e:platform

# Run E2E tests against a specific environment
STAGE=development pnpm --filter @flex/e2e test:e2e:platform
```

### Validating Infrastructure

```bash
# Synthesise CloudFormation templates
pnpm --filter @platform/<name> synth

# Security scan
pnpm --filter @platform/<name> checkov

# Compare with deployed stack
pnpm --filter @platform/<name> diff
```

---

## Common Tasks

### Adding a New Package

1. Create package structure (see [Package Development](#package-development))
2. Create `README.md` using the [FLEX Platform SDK template](/docs/documentation-guide.md#flex-platform-sdk)
3. Implement functionality with tests
4. Run tests locally with `pnpm --filter @flex/<package> test`
5. Deploy and run E2E tests with `pnpm --filter @flex/e2e test:e2e:platform`
6. Update the [Domain Development Guide](/docs/domain-development.md) if the package is intended for domain developers

### Adding a New Platform Domain Handler

1. Create handler structure (see [Platform Domain Handler Development](#platform-domain-handler-development))
2. Implement handler with tests
3. Run tests locally with `pnpm --filter @platform/<domain> test`
4. Deploy and run E2E tests with `pnpm --filter @flex/e2e test:e2e:platform`
5. Add resources to `@platform/flex` infrastructure
6. Create `README.md` using the [FLEX Platform Domain template](/docs/documentation-guide.md#flex-platform-domain)

### Adding a New Service Gateway

1. Create service gateway structure (see [Service Gateway Development](#service-gateway-development))
2. Define `gateway.config.ts` and implement `src/gateway.ts` with tests
3. Run tests locally with `pnpm --filter @flex/<name>-service-gateway test`
4. Deploy new gateway. No infrastructure changes required for this step as the gateway is automatically discovered and provisioned
5. Add a "gateway" integration in a domain's `domain.config.ts` and consume it to verify the gateway works as intended
6. Create `README.md` using the [FLEX Platform Domain template](/docs/documentation-guide.md#flex-platform-domain)

### Adding a New Domain

1. Create domain structure in `domains/<domain>/` following the [Domain Development Guide](/docs/domain-development.md)
2. Create domain construct in `platform/infra/flex/src/constructs/<domain>.ts`
3. Instantiate domain construct in `platform/infra/flex/src/stack.ts`
4. Create `README.md` using the [FLEX Domain template](/docs/documentation-guide.md#flex-domain)

### Modifying Core Infrastructure

1. Make changes in `@platform/core`
2. Validate with `pnpm --filter @platform/<name> synth`
3. Run `pnpm --filter @platform/<name> checkov` for security validation
4. Compare with `pnpm --filter @platform/<name> diff`
5. Deploy to `development` environment first
6. Update SSM imports in `@platform/flex` if paths changed

### Updating Shared Configuration

Changes to `@flex/config` affect all packages:

1. Update configuration in `libs/config/src/`
2. Run `pnpm lint` across repository to verify
3. Fix all violations before committing

---

## Related

**FLEX:**

- [@flex/config](/libs/config/README.md)
- [@flex/logging](/libs/logging/README.md)
- [@flex/sdk](/libs/sdk/README.md)
- [@flex/service-gateway](/libs/service-gateway/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@flex/utils](/libs/utils/README.md)
- [@platform/flex](/platform/infra/flex/README.md)

**Guides:**

- [Environment Setup](/docs/environment-setup.md)
- [Domain Development Guide](/docs/domain-development.md)
- [Deployment Guide](/docs/deployment.md)
- [Developer Reference](/docs/developer-reference.md)
- [Documentation Guide](/docs/documentation-guide.md)
