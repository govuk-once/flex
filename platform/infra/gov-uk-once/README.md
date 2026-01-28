# @platform/gov-uk-once

Base CDK stack with GDS-compliant tagging for all FLEX infrastructure.

---

## Commands

Run these from the repository root:

| Command                                    | Description |
| ------------------------------------------ | ----------- |
| `pnpm --filter @platform/gov-uk-once lint` | Lint files  |

> Alternatively, run `pnpm <command>` from within `platform/infra/gov-uk-once/`.

## Overview

| Export                              | Description                                      |
| ----------------------------------- | ------------------------------------------------ |
| [`GovUkOnceStack`](#govukoncestack) | Base CDK stack with GDS tagging                  |
| [`getEnvConfig`](#getenvconfig)     | Returns environment configuration for deployment |
| [`getStackName`](#getstackname)     | Returns stage-prefixed stack name                |

---

## GovUkOnceStack

Base CDK stack that enforces GDS-compliant tagging on all resources. All platform stacks must extend this stack.

### Usage

```typescript
import { GovUkOnceStack } from "@platform/gov-uk-once";
import type { Construct } from "constructs";

export class MyStack extends GovUkOnceStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "",
        Source: "https://github.com/govuk-once/flex",
      },
    });

    // Define resources using `getResourceName` for consistent naming
    const resource = this.getResourceName("MyResource");
  }
}
```

### API

```typescript
class GovUkOnceStack extends cdk.Stack {
  getResourceName(component: string): string;
}
```

#### Tags

| Tag                  | Required | Description                  |
| -------------------- | -------- | ---------------------------- |
| `Product`            | Yes      | Product name (e.g. `GOV.UK`) |
| `System`             | Yes      | System name (e.g. `FLEX`)    |
| `Owner`              | Yes      | Team or individual owner     |
| `Service`            | No       | Service name                 |
| `Source`             | No       | Repository URL               |
| `Exposure`           | No       | Public/private exposure      |
| `DataClassification` | No       | Data sensitivity             |
| `CostCentre`         | No       | Cost allocation code         |

> The `Environment` tag is added automatically based on the deployment stage.

---

## getEnvConfig

Returns the environment configuration for the current deployment based on environment variables.

### Usage

```typescript
import { getEnvConfig } from "@platform/gov-uk-once";

const {
  stage, // "development" | "pr-123" | "my-long-user" (truncated from "my-long-username")
  environment, // "development" | "integration" | "staging" | "production"
  persistent, // true for CI environments, false for ephemeral
} = getEnvConfig();
```

### API

```typescript
getEnvConfig(): {
  stage: string;
  environment: string;
  persistent: boolean;
}
```

### Environment Variables

| Variable | Purpose                           | Example                            |
| -------- | --------------------------------- | ---------------------------------- |
| `STAGE`  | CI/CD environments                | `development`, `staging`, `pr-123` |
| `USER`   | Ephemeral environments (fallback) | `john`                             |

The stage name is sanitised: converted to lowercase, non-alphanumeric characters removed (except hyphens), and truncated to 12 characters.

> Throws if neither `STAGE` nor `USER` is set.

---

## getStackName

Returns a stack name prefixed with the current stage.

### Usage

```typescript
import { getStackName } from "@platform/gov-uk-once";

const stackName = getStackName("FlexPlatform");
// "development-FlexPlatform" or "pr-123-FlexPlatform"
```

### API

```typescript
getStackName(stack: string): string
```

---

## Related

**FLEX:**

- [@platform/core](../core/README.md)
- [@platform/flex](../flex/README.md)
- [@platform/parameter](../parameter/README.md)
- [Platform Development Guide](../../../docs/platform-development.md)

**External:**

- [GDS Way - AWS Tagging](https://gds-way.digital.cabinet-office.gov.uk/manuals/aws-tagging.html)
