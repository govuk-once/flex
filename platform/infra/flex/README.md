# @platform/flex

Main platform infrastructure for FLEX including API Gateway, Lambda constructs and CloudFront distribution.

---

## Commands

Run these from the repository root:

| Command                                | Description                          |
| -------------------------------------- | ------------------------------------ |
| `pnpm --filter @platform/flex checkov` | Run Checkov security scan            |
| `pnpm --filter @platform/flex deploy`  | Deploy stack to current stage        |
| `pnpm --filter @platform/flex destroy` | Destroy stack from current stage     |
| `pnpm --filter @platform/flex dev`     | Watch and synthesise on file changes |
| `pnpm --filter @platform/flex diff`    | Show deployment differences          |
| `pnpm --filter @platform/flex lint`    | Lint files                           |
| `pnpm --filter @platform/flex synth`   | Synthesise CloudFormation template   |

> Alternatively, run `pnpm <command>` from within `platform/infra/flex/`.

## Overview

| Export                                  | Description                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| [Lambda Constructs](#lambda-constructs) | `FlexPublicFunction`, `FlexPrivateEgressFunction`, `FlexPrivateIsolatedFunction` |
| [Utilities](#utilities)                 | `getEntry`, `getPlatformEntry`                                                   |

---

## Stack

`FlexPlatformStack` deploys the application layer infrastructure.

### Resources

| Resource          | Description                                                    |
| ----------------- | -------------------------------------------------------------- |
| HTTP API          | API Gateway V2 with CORS and Lambda authorizer                 |
| CloudFront        | Distribution with fail-fast behaviour via `FlexFailFast`       |
| Lambda Authorizer | JWT validation using `FlexAuthentication`                      |
| Domain Routes     | Hello domain (public, private, isolated) and UDP domain routes |

### Outputs

| Output                      | Description                 | Used By                       |
| --------------------------- | --------------------------- | ----------------------------- |
| `HttpApiUrl`                | API Gateway endpoint URL    | E2E tests, external clients   |
| `CloudfrontDistributionUrl` | CloudFront distribution URL | E2E tests, production traffic |

These outputs are consumed by `@flex/testing/e2e`.

---

## Lambda Constructs

Three constructs for deploying Lambda functions each with different network configurations. All constructs:

- Use Node.js 24.x runtime
- Enable X-Ray tracing
- Create dedicated log groups
- Tag with `ResourceOwner` when `domain` is provided

### FlexPublicFunction

Lambda deployed without VPC attachment. Use for handlers that don't require VPC resources.

```typescript
import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";

import { FlexPublicFunction } from "./constructs/flex-public-function";
import { getEntry } from "./utils/getEntry";

const handler = new FlexPublicFunction(this, "MyFunction", {
  entry: getEntry("domain-name", "handlers/handler-name/get.ts"),
  domain: "domain-name",
});

httpApi.addRoutes({
  path: "/resource",
  methods: [HttpMethod.GET],
  integration: new HttpLambdaIntegration("MyHandler", handler.function),
});
```

### FlexPrivateEgressFunction

Lambda deployed in private subnets with NAT gateway access. Use for handlers that need to call external APIs.

```typescript
import { FlexPrivateEgressFunction } from "./constructs/flex-private-egress-function";
import { getEntry } from "./utils/getEntry";

const handler = new FlexPrivateEgressFunction(this, "MyFunction", {
  entry: getEntry("domain-name", "handlers/handler-name/get.ts"),
  domain: "domain-name",
});

httpApi.addRoutes({
  path: "/resource",
  methods: [HttpMethod.GET],
  integration: new HttpLambdaIntegration("MyHandler", handler.function),
});
```

### FlexPrivateIsolatedFunction

Lambda deployed in isolated subnets with no internet access. Use for handlers that only need VPC resources.

```typescript
import { FlexPrivateIsolatedFunction } from "./constructs/flex-private-isolated-function";
import { getEntry } from "./utils/getEntry";

const handler = new FlexPrivateIsolatedFunction(this, "MyFunction", {
  entry: getEntry("domain-name", "handlers/handler-name/get.ts"),
  domain: "domain-name",
});

httpApi.addRoutes({
  path: "/resource",
  methods: [HttpMethod.GET],
  integration: new HttpLambdaIntegration("MyHandler", handler.function),
});
```

### Props

All Lambda constructs accept `FlexFunctionProps`:

| Prop      | Type                  | Required | Description                                                 |
| --------- | --------------------- | -------- | ----------------------------------------------------------- |
| `entry`   | `string`              | Yes      | Path to handler file (use `getEntry` or `getPlatformEntry`) |
| `domain`  | `string`              | No       | Domain name for `ResourceOwner` tag                         |
| `...rest` | `NodejsFunctionProps` | No       | All other AWS CDK NodejsFunction props                      |

---

## Internal Constructs

These constructs are used internally by the stack and generally don't need direct instantiation.

| Construct                    | Purpose                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| `FlexAuthentication`         | Lambda authorizer with Redis caching and Cognito validation |
| `FlexFailFast`               | CloudFront distribution with structural validation          |
| `FlexCloudfrontDistribution` | Base CloudFront construct wrapping API Gateway origin       |
| `FlexCloudfrontFunction`     | CloudFront function for edge request validation             |
| `RouteGroup`                 | Group related API routes under a common path prefix         |

---

## Domain Integration

Domains can be integrated as constructs that encapsulate their routes. See `UdpDomain` for the pattern:

```typescript
import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";

import { getEntry } from "../utils/getEntry";
import { FlexPrivateIsolatedFunction } from "./flex-private-isolated-function";

export class UserDomain extends Construct {
  constructor(scope: Construct, id: string, routeGroup: RouteGroup) {
    super(scope, id);

    const createUserFunction = new FlexPrivateIsolatedFunction(
      this,
      "CreateUserFunction",
      {
        entry: getEntry("user", "handlers/users/post.ts"),
        domain: "user",
      },
    );

    routeGroup.addRoutes(
      "/user",
      HttpMethod.POST,
      new HttpLambdaIntegration("CreateUser", createUserFunction.function),
    );
  }
}
```

Then instantiate in the stack:

```typescript
const v1 = new RouteGroup(this, "V1", { httpApi, pathPrefix: "/1.0/app" });

new UserDomain(this, "UserDomain", v1);
```

---

## Utilities

### getEntry

Resolves handler paths for domain handlers in `domains/`.

```typescript
import { getEntry } from "./utils/getEntry";

getEntry("hello", "handlers/hello-public/get.ts"); // "/domains/hello/src/handlers/hello-public/get.ts"
```

### getPlatformEntry

Resolves handler paths for platform handlers in `platform/domains/`.

```typescript
import { getPlatformEntry } from "./utils/getEntry";

getPlatformEntry("auth", "handler.ts"); // "/platform/domains/auth/src/handler.ts"
```

---

## Related

**FLEX:**

- [@platform/core](../core/README.md)
- [@platform/gov-uk-once](../gov-uk-once/README.md)
- [@platform/parameter](../parameter/README.md)
- [Platform Development Guide](../../../docs/platform-development.md)
