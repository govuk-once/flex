# @platform/flex

Main platform infrastructure for FLEX including API Gateway, Lambda constructs and CloudFront distribution.

---

## Commands

Run these from the repository root:

| Command                                | Description                          |
| -------------------------------------- | ------------------------------------ |
| `pnpm --filter @platform/flex checkov` | Run Checkov security scan            |
| `pnpm --filter @platform/flex deploy`  | Deploy stack                         |
| `pnpm --filter @platform/flex destroy` | Destroy stack                        |
| `pnpm --filter @platform/flex dev`     | Watch and synthesise on file changes |
| `pnpm --filter @platform/flex diff`    | Show deployment differences          |
| `pnpm --filter @platform/flex hotswap` | Deploy with hotswap                  |
| `pnpm --filter @platform/flex lint`    | Lint files                           |
| `pnpm --filter @platform/flex synth`   | Synthesise CloudFormation            |
| `pnpm --filter @platform/flex tsc`     | Run type check                       |

> Alternatively, run `pnpm <command>` from within `platform/infra/flex/`.

---

## API

| Name                          | Description         | Code                   |
| ----------------------------- | ------------------- | ---------------------- |
| [`FlexPlatformStack`](#stack) | Main platform stack | [View](./src/stack.ts) |

### Types

| Name                | Description                          | Code                              |
| ------------------- | ------------------------------------ | --------------------------------- |
| `FlexFunctionProps` | Props for Lambda function constructs | [View](./src/constructs/types.ts) |

> See [Constructs](#constructs) for Lambda function constructs.
> See [Utilities](#utilities) for common utilities and helpers.

---

## `FlexPlatformStack`

Deploys the application layer infrastructure.

### Usage

```typescript
import { getStackName } from "@platform/gov-uk-once";
import * as cdk from "aws-cdk-lib";

import { FlexPlatformStack } from "./stack";

const app = new cdk.App();

new FlexPlatformStack(app, getStackName("FlexPlatform"));
```

### Resources

| Resource          | Description                                              |
| ----------------- | -------------------------------------------------------- |
| HTTP API          | API Gateway V2 with CORS and Lambda authorizer           |
| CloudFront        | Distribution with fail-fast behaviour via `FlexFailFast` |
| Lambda Authorizer | JWT validation using `FlexAuthentication`                |
| Domain Routes     | Hello domain (public, private, isolated) and UDP domain  |

### Outputs

| Output                      | Description                 | Used By                       |
| --------------------------- | --------------------------- | ----------------------------- |
| `HttpApiUrl`                | API Gateway endpoint URL    | E2E tests, external clients   |
| `CloudfrontDistributionUrl` | CloudFront distribution URL | E2E tests, production traffic |

---

## Constructs

| Name                                                          | Description                               | Code                                                       |
| ------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------- |
| [`FlexPublicFunction`](#flexpublicfunction)                   | Lambda without VPC attachment             | [View](./src/constructs/flex-public-function.ts)           |
| [`FlexPrivateEgressFunction`](#flexprivateegressfunction)     | Lambda in private subnets with NAT access | [View](./src/constructs/flex-private-egress-function.ts)   |
| [`FlexPrivateIsolatedFunction`](#flexprivateisolatedfunction) | Lambda in isolated subnets, no internet   | [View](./src/constructs/flex-private-isolated-function.ts) |
| [`RouteGroup`](#routegroup)                                   | Group API routes under a path prefix      | [View](./src/constructs/flex-route-group.ts)               |

All Lambda constructs use Node.js 24.x runtime, enable X-Ray tracing, create dedicated log groups, and tag with `ResourceOwner` when `domain` is provided.

### Internal Constructs

These constructs are used internally by the stack and generally don't need direct instantiation.

| Name                         | Description                                         | Code                                                     |
| ---------------------------- | --------------------------------------------------- | -------------------------------------------------------- |
| `FlexAuthentication`         | Lambda authorizer with Cognito validation           | [View](./src/constructs/flex-authentication.ts)          |
| `FlexCloudfrontDistribution` | CloudFront distribution wrapping API Gateway origin | [View](./src/constructs/flex-cloudfront-distribution.ts) |
| `FlexCloudfrontFunction`     | CloudFront function for edge request validation     | [View](./src/constructs/flex-cloudfront-function.ts)     |
| `FlexFailFast`               | CloudFront distribution with structural validation  | [View](./src/constructs/flex-fail-fast.ts)               |
| `UdpDomain`                  | UDP domain routes construct                         | [View](./src/constructs/udp.ts)                          |

### `FlexPublicFunction`

Lambda deployed without VPC attachment. Use for handlers that don't require VPC resources.

```typescript
import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";

import { FlexPublicFunction } from "./constructs/flex-public-function";
import { getEntry } from "./utils/getEntry";

const handler = new FlexPublicFunction(this, "ExampleFunction", {
  entry: getEntry("domain", "handlers/handler/get.ts"),
  domain: "domain",
});

httpApi.addRoutes({
  path: "/example",
  methods: [HttpMethod.GET],
  integration: new HttpLambdaIntegration("ExampleHandler", handler.function),
});
```

### `FlexPrivateEgressFunction`

Lambda deployed in private subnets with NAT gateway access. Use for handlers that need to call external APIs.

```typescript
import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";

import { FlexPrivateEgressFunction } from "./constructs/flex-private-egress-function";
import { getEntry } from "./utils/getEntry";

const handler = new FlexPrivateEgressFunction(this, "ExampleFunction", {
  entry: getEntry("domain", "handlers/handler/get.ts"),
  domain: "domain",
});

httpApi.addRoutes({
  path: "/example",
  methods: [HttpMethod.GET],
  integration: new HttpLambdaIntegration("ExampleHandler", handler.function),
});
```

### `FlexPrivateIsolatedFunction`

Lambda deployed in isolated subnets with no internet access. Use for handlers that only need VPC resources.

```typescript
import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";

import { FlexPrivateIsolatedFunction } from "./constructs/flex-private-isolated-function";
import { getEntry } from "./utils/getEntry";

const handler = new FlexPrivateIsolatedFunction(this, "ExampleFunction", {
  entry: getEntry("domain", "handlers/handler/get.ts"),
  domain: "domain",
});

httpApi.addRoutes({
  path: "/path",
  methods: [HttpMethod.GET],
  integration: new HttpLambdaIntegration("ExampleHandler", handler.function),
});
```

### `RouteGroup`

Groups related API routes under a common path prefix.

```typescript
import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";

import { RouteGroup } from "./constructs/flex-route-group";

const v1 = new RouteGroup(this, "V1", {
  httpApi,
  pathPrefix: "/1.0/app",
});

v1.addRoute(
  "/example",
  HttpMethod.GET,
  new HttpLambdaIntegration("ExampleHandler", exampleHandler.function),
);
// Creates route: /1.0/app/example
```

---

## Domain Integration

Domains can be integrated as constructs that encapsulate their routes:

```typescript
import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";

import { FlexPrivateIsolatedFunction } from "./constructs/flex-private-isolated-function";
import { RouteGroup } from "./constructs/flex-route-group";
import { getEntry } from "./utils/getEntry";

export class ExampleDomain extends Construct {
  constructor(scope: Construct, id: string, routeGroup: RouteGroup) {
    super(scope, id);

    const exampleFunction = new FlexPrivateIsolatedFunction(
      this,
      "ExampleIsolatedFunction",
      {
        entry: getEntry("domain", "handlers/service/post.ts"),
        domain: "domain",
      },
    );

    routeGroup.addRoute(
      "/path",
      HttpMethod.POST,
      new HttpLambdaIntegration("ExampleHandler", exampleFunction.function),
    );

    // Define additional routes...
  }
}
```

Then instantiate in the stack:

```typescript
const v1 = new RouteGroup(this, "V1", { httpApi, pathPrefix: "/1.0/app" });

new ExampleDomain(this, "ExampleDomain", v1);
```

---

## Utilities

| Name                                    | Description                       | Code                            |
| --------------------------------------- | --------------------------------- | ------------------------------- |
| [`getEntry`](#getentry)                 | Resolve handler path for domains  | [View](./src/utils/getEntry.ts) |
| [`getPlatformEntry`](#getplatformentry) | Resolve handler path for platform | [View](./src/utils/getEntry.ts) |

### `getEntry`

Resolves handler paths for domain handlers in `domains/`.

```typescript
import { getEntry } from "./utils/getEntry";

getEntry("hello", "handlers/hello-public/get.ts");
// "/domains/hello/src/handlers/hello-public/get.ts"
```

### `getPlatformEntry`

Resolves handler paths for platform handlers in `platform/domains/`.

```typescript
import { getPlatformEntry } from "./utils/getEntry";

getPlatformEntry("auth", "handler.ts");
// "/platform/domains/auth/src/handler.ts"
```

---

## Related

**FLEX:**

- [@platform/core](/platform/infra/core/README.md)
- [@platform/gov-uk-once](/platform/infra/gov-uk-once/README.md)
- [Platform Development Guide](/docs/platform-development.md)
