# Platform Development Guide

Guide for developers maintaining FLEX platform infrastructure and shared libraries.

---

## Overview

| Area                     | Description                                                         |
| ------------------------ | ------------------------------------------------------------------- |
| Packages                 | Shared utilities consumed by developers working on FLEX             |
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
import { config } from "@flex/config/eslint";

export default config;
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
import { config } from "@flex/config/vitest";

export default config;
```

3. Create entry point at `src/index.ts`
4. Create `README.md` using the [FLEX Platform SDK template](/docs/documentation-guide.md#flex-platform-sdk)
5. Run `pnpm install` from the repository root to link the new package and install its dependencies

### Export Conventions

- Export modules and types from `src/index.ts`
- Always keep the `README.md` up to date for discoverability

```typescript
// src/index.ts
export { createLambdaHandler } from "./createLambdaHandler";
export type { LambdaHandlerConfig } from "./createLambdaHandler";
```

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
    "@flex/handlers": "workspace:*",
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
import { getStackName } from "@platform/gov-uk-once";

import { ExampleStack } from "./stack";

const app = new cdk.App();

new ExampleStack(app, getStackName("ExampleStack"));
```

### Stack Definition

All stacks extend `GovUkOnceStack` for consistent GDS-compliant tagging:

```typescript
import { GovUkOnceStack } from "@platform/gov-uk-once";
import type { Construct } from "constructs";

export class ExampleStack extends GovUkOnceStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "",
        Source: "https://github.com/govuk-once/flex",
      },
    });

    // Define resources, call methods, etc
  }
}
```

### Stack Naming Convention

Use `getStackName()` for consistent stage-prefixed names:

```typescript
import { getStackName } from "@platform/gov-uk-once";

new ExampleStack(app, getStackName("ExampleStack"));
// "development-ExampleStack", "pr-123-ExampleStack", etc.
```

### Environment Configuration

Use `getEnvConfig()` to access environment details:

```typescript
import { getEnvConfig } from "@platform/gov-uk-once";

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

---

## Testing

See [@flex/testing](/libs/testing/README.md) for the complete list of available fixtures.

### Unit Tests

Create a test file at `platform/domains/<handler>/src/handler.test.ts`:

```typescript
import { context, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./handler";

describe("handler", () => {
  it("returns 200 with expected response", async ({ event, response }) => {
    const result = await handler(event.get("/path"), context);

    expect(result).toEqual(response.ok({ message: "Success" }));
  });

  it("returns 400 for invalid request", async ({ event, response }) => {
    const result = await handler(event.post("/path", { body: {} }), context);

    expect(result).toEqual(
      response.badRequest({ error: "Invalid request body" }),
    );
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
pnpm --filter @flex/e2e test:e2e

# Run E2E tests against a specific environment
STAGE=development pnpm --filter @flex/e2e test:e2e
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
5. Deploy and run E2E tests with `pnpm --filter @flex/e2e test:e2e`
6. Update the [Domain Development Guide](/docs/domain-development.md) if the package is intended for domain developers

### Adding a New Platform Domain Handler

1. Create handler structure (see [Platform Domain Development](#platform-domain-development))
2. Implement handler with tests
3. Run tests locally with `pnpm --filter @platform/<domain> test`
4. Deploy and run E2E tests with `pnpm --filter @flex/e2e test:e2e`
5. Add resources to `@platform/flex` infrastructure
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
- [@flex/handlers](/libs/handlers/README.md)
- [@flex/logging](/libs/logging/README.md)
- [@flex/middlewares](/libs/middlewares/README.md)
- [@flex/params](/libs/params/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@flex/utils](/libs/utils/README.md)
- [@platform/core](/platform/infra/core/README.md)
- [@platform/flex](/platform/infra/flex/README.md)
- [@platform/gov-uk-once](/platform/infra/gov-uk-once/README.md)

**Guides:**

- [Environment Setup](/docs/environment-setup.md)
- [Domain Development Guide](/docs/domain-development.md)
- [Deployment Guide](/docs/deployment.md)
- [Developer Reference](/docs/developer-reference.md)
- [Documentation Guide](/docs/documentation-guide.md)
