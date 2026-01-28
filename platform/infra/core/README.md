# @platform/core

Core networking infrastructure for FLEX including VPC, subnets, security groups and ElastiCache.

---

## Commands

Run these from the repository root:

| Command                                | Description                 |
| -------------------------------------- | --------------------------- |
| `pnpm --filter @platform/core checkov` | Run Checkov security scan   |
| `pnpm --filter @platform/core deploy`  | Deploy stack                |
| `pnpm --filter @platform/core diff`    | Show deployment differences |
| `pnpm --filter @platform/core lint`    | Lint files                  |
| `pnpm --filter @platform/core synth`   | Synthesise CloudFormation   |

> Alternatively, run `pnpm <command>` from within `platform/infra/core/`.

## Overview

| Export                                           | Description                 |
| ------------------------------------------------ | --------------------------- |
| [`@platform/core/outputs`](#platformcoreoutputs) | SSM import/export functions |

## Stack

`FlexCoreStack` deploys the foundational networking and caching infrastructure.

### Usage

```typescript
new FlexCoreStack(scope, { id: "MyIdentifier", enableNat: true });
```

| Option      | Type      | Description                                    |
| ----------- | --------- | ---------------------------------------------- |
| `id`        | `string`  | Stack identifier                               |
| `enableNat` | `boolean` | Enable NAT gateways for private egress subnets |

### Resources

| Resource                 | Description                                                         |
| ------------------------ | ------------------------------------------------------------------- |
| VPC                      | `10.0.0.0/16` CIDR across `eu-west-2a`, `eu-west-2b`, `eu-west-2c`  |
| Public subnets           | `/24` subnets for internet-facing resources                         |
| Private egress subnets   | `/19` subnets with NAT gateway access                               |
| Private isolated subnets | `/19` subnets with no internet access                               |
| Security groups          | `PrivateEgress` (outbound allowed), `PrivateIsolated` (no outbound) |
| VPC endpoints            | CloudWatch Logs, Secrets Manager                                    |
| ElastiCache              | Redis cluster (3 nodes, multi-AZ) for authentication caching        |

### SSM Parameters

The stack exports configuration to SSM for consumption by other stacks:

| Parameter           | Path                                                       |
| ------------------- | ---------------------------------------------------------- |
| VPC ID              | `/{env}/flex-core/vpc/id`                                  |
| Private Egress SG   | `/{env}/flex-core/network/security-group/private-egress`   |
| Private Isolated SG | `/{env}/flex-core/network/security-group/private-isolated` |
| Redis Endpoint      | `/{env}/flex-core/cache/redis/endpoint`                    |

## @platform/core/outputs

Functions for exporting and importing infrastructure references via SSM.

### Usage

Import VPC details in another stack:

```typescript
import {
  importRedisEndpointFromSsm,
  importVpcDetailsFromSsm,
} from "@platform/core/outputs";

// In your stack constructor
const { vpc, securityGroups } = importVpcDetailsFromSsm(this);
const redisEndpoint = importRedisEndpointFromSsm(this);
```

### API

| Function                     | Description                             |
| ---------------------------- | --------------------------------------- |
| `exportRedisEndpointToSsm`   | Write Redis endpoint to SSM             |
| `exportVpcDetailsToSsm`      | Write VPC and security group IDs to SSM |
| `importRedisEndpointFromSsm` | Read Redis endpoint from SSM            |
| `importVpcDetailsFromSsm`    | Read VPC and security groups from SSM   |

---

## Related

**FLEX:**

- [@platform/flex](../flex/README.md)
- [@platform/gov-uk-once](../gov-uk-once/README.md)
- [Platform Development Guide](../../../docs/platform-development.md)
