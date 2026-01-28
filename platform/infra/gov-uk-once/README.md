# @platform/gov-uk-once

Base CDK stack with GDS-compliant tagging and environment utilities for all FLEX infrastructure.

---

## Commands

Run these from the repository root:

| Command                                    | Description |
| ------------------------------------------ | ----------- |
| `pnpm --filter @platform/gov-uk-once lint` | Lint files  |

> Alternatively, run `pnpm <command>` from within `platform/infra/gov-uk-once/`.

## API

| Name                                | Description                       | Code                   |
| ----------------------------------- | --------------------------------- | ---------------------- |
| [`GovUkOnceStack`](#govukoncestack) | Base CDK stack with GDS tagging   | [View](./src/index.ts) |
| [`getEnvConfig`](#getenvconfig)     | Returns environment configuration | [View](./src/index.ts) |
| [`getStackName`](#getstackname)     | Returns stage-prefixed stack name | [View](./src/index.ts) |

---

## `GovUkOnceStack`

Base CDK stack that enforces GDS-compliant tagging on all resources. All platform stacks must extend this stack.

### Usage

```typescript
import { GovUkOnceStack } from "@platform/gov-uk-once";
import type { Construct } from "constructs";

export class CustomStack extends GovUkOnceStack {
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

### Tags

| Tag                  | Required | Description                                                           |
| -------------------- | -------- | --------------------------------------------------------------------- |
| `Product`            | Yes      | Product name (e.g. `GOV.UK`)                                          |
| `System`             | Yes      | System name (e.g. `FLEX`)                                             |
| `Environment`        | Yes\*    | Must be one of: `development`, `integration`, `staging`, `production` |
| `Owner`              | Yes      | Team or individual owner                                              |
| `Service`            | No       | Service name                                                          |
| `Source`             | No       | Repository URL                                                        |
| `Exposure`           | No       | Public/private exposure                                               |
| `DataClassification` | No       | Data sensitivity                                                      |
| `CostCentre`         | No       | Cost allocation code                                                  |

> \*`Environment` is added automatically based on the deployment stage.

---

## `getEnvConfig`

Returns the environment configuration for the current deployment.

### Usage

```typescript
import { getEnvConfig } from "@platform/gov-uk-once";

const { stage, environment, persistent } = getEnvConfig();
// { stage: "pr-123", environment: "development", persistent: true }
```

### Stage Resolution

| Source          | Example Input      | Resulting Stage |
| --------------- | ------------------ | --------------- |
| `STAGE` env var | `development`      | `development`   |
| `STAGE` env var | `integration`      | `integration`   |
| `STAGE` env var | `staging`          | `staging`       |
| `STAGE` env var | `production`       | `production`    |
| `STAGE` env var | `pr-123`           | `pr-123`        |
| `USER` fallback | `example-username` | `example-user`  |

Stage names are sanitised: lowercase, non-alphanumeric characters removed (except hyphens), truncated to 12 characters.

> Throws if neither `STAGE` nor `USER` environment variable is set

---

## `getStackName`

Returns a stack name prefixed with the current stage.

### Usage

```typescript
import { getStackName } from "@platform/gov-uk-once";

const stackName = getStackName("FlexPlatform");
// Examples: "example-user-FlexPlatform", "pr-123-FlexPlatform", "development-FlexPlatform"
```

---

## Related

**FLEX:**

- [@platform/core](/platform/infra/core/README.md)
- [@platform/flex](/platform/infra/flex/README.md)
- [Platform Development Guide](/docs/platform-development.md)

**External:**

- [GDS Way - AWS Tagging](https://gds-way.digital.cabinet-office.gov.uk/manuals/aws-tagging.html)
