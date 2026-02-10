# @platform/core

Core networking infrastructure for FLEX including VPC, subnets, security groups, VPC endpoints and ElastiCache.

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
| `pnpm --filter @platform/core tsc`     | Run type check              |

> Alternatively, run `pnpm <command>` from within `platform/infra/core/`.

## API

| Name                                                    | Description                                  | Code                       |
| ------------------------------------------------------- | -------------------------------------------- | -------------------------- |
| [`addVpcEndpoints`](#addvpcendpoints)                   | Creates VPC interface endpoints              | [View](./src/endpoints.ts) |
| [`createElastiCacheCluster`](#createelasticachecluster) | Creates Redis replication group              | [View](./src/cache.ts)     |
| [`createVpc`](#createvpc)                               | Creates VPC with subnets and security groups | [View](./src/vpc.ts)       |
| [`FlexCoreStack`](#stack)                               | Core infrastructure stack                    | [View](./src/stack.ts)     |

### Outputs

Available exports via `@platform/core/outputs`.

| Name                                | Description                             | Code                     |
| ----------------------------------- | --------------------------------------- | ------------------------ |
| `exportInterfaceVpcEndpointToSsm`   | Write VPC endpoint ID to SSM            | [View](./src/outputs.ts) |
| `exportSecurityGroupToSsm`          | Write security group ID to SSM          | [View](./src/outputs.ts) |
| `exportStringToSsm`                 | Write arbitrary string to SSM           | [View](./src/outputs.ts) |
| `exportVpcToSsm`                    | Write VPC ID to SSM                     | [View](./src/outputs.ts) |
| `importFlexKmsKeyAlias`             | Import KMS key by alias from SSM        | [View](./src/outputs.ts) |
| `importFlexParameter`               | Import FLEX parameter from SSM          | [View](./src/outputs.ts) |
| `importFlexSecret`                  | Import FLEX secret from Secrets Manager | [View](./src/outputs.ts) |
| `importInterfaceVpcEndpointFromSsm` | Import VPC endpoint from SSM            | [View](./src/outputs.ts) |
| `importSecurityGroupFromSsm`        | Import security group from SSM          | [View](./src/outputs.ts) |
| `importStringFromSsm`               | Import arbitrary string from SSM        | [View](./src/outputs.ts) |
| `importVpcFromSsm`                  | Import VPC from SSM                     | [View](./src/outputs.ts) |

---

## `addVpcEndpoints`

Creates VPC interface endpoints for API Gateway, CloudWatch Logs and Secrets Manager. Configures egress rules on the provided security group.

### Usage

```typescript
import { addVpcEndpoints } from "./endpoints";

const { apiGatewayEndpoint, cloudwatchEndpoint, secretsManagerEndpoint } =
  addVpcEndpoints({
    vpc,
    securityGroup: securityGroups.privateIsolated,
  });
```

---

## `createElastiCacheCluster`

Creates a Redis replication group with one shard and two replicas, deployed across isolated subnets with multi-AZ failover.

### Usage

```typescript
import { createElastiCacheCluster } from "./cache";

const { cacheCluster } = createElastiCacheCluster(this, {
  vpc,
  securityGroups: [
    securityGroups.privateEgress,
    securityGroups.privateIsolated,
  ],
});
```

---

## `createVpc`

Creates a VPC with public, private egress, and private isolated subnets across three availability zones. Returns the VPC and two security groups.

### Usage

```typescript
import { createVpc } from "./vpc";

const { vpc, securityGroups } = createVpc(this);
// vpc: Vpc
// securityGroups.privateEgress: SecurityGroup (allowAllOutbound: true)
// securityGroups.privateIsolated: SecurityGroup (allowAllOutbound: false)
```

---

## Importing from SSM

Other stacks import core infrastructure references via `@platform/core/outputs`.

### VPC and Security Groups

```typescript
import {
  importSecurityGroupFromSsm,
  importVpcFromSsm,
} from "@platform/core/outputs";

const vpc = importVpcFromSsm(this, "/flex-core/vpc");

const privateEgress = importSecurityGroupFromSsm(
  this,
  "/flex-core/security-group/private-egress",
);

const privateIsolated = importSecurityGroupFromSsm(
  this,
  "/flex-core/security-group/private-isolated",
);
```

### VPC Endpoints

```typescript
import { importInterfaceVpcEndpointFromSsm } from "@platform/core/outputs";

const apiGatewayVpcEndpoint = importInterfaceVpcEndpointFromSsm(
  this,
  "/flex-core/vpc-endpoint/api-gateway",
);
```

### Cache Endpoint

```typescript
import { importStringFromSsm } from "@platform/core/outputs";

const cacheEndpoint = importStringFromSsm(this, "/flex-core/cache/endpoint");
```

### FLEX Parameters and Secrets

```typescript
import {
  importFlexKmsKeyAlias,
  importFlexParameter,
  importFlexSecret,
} from "@platform/core/outputs";

const userPoolId = importFlexParameter(this, "/flex-param/auth/user-pool-id");

const clientId = importFlexParameter(this, "/flex-param/auth/client-id");

const notificationHashingSecret = importFlexSecret(
  this,
  "/flex-secret/udp/notification-hash-secret",
);

const encryptionKey = importFlexKmsKeyAlias(
  this,
  "/flex-secret/encryption-key",
);
```

---

## Stack

`FlexCoreStack` deploys foundational networking and caching infrastructure. This stack only deploys to persistent environments (`development`, `integration`, `staging`, `production`).

### Usage

```typescript
import { FlexCoreStack } from "./stack";

new FlexCoreStack(app, getStackName("FlexCore"));
```

### Resources

| Resource                 | Description                                                         |
| ------------------------ | ------------------------------------------------------------------- |
| VPC                      | `10.0.0.0/16` CIDR across `eu-west-2a`, `eu-west-2b`, `eu-west-2c`  |
| Public subnets           | `/24` subnets for internet-facing resources                         |
| Private egress subnets   | `/19` subnets with NAT gateway access                               |
| Private isolated subnets | `/19` subnets with no internet access                               |
| Security groups          | `PrivateEgress` (outbound allowed), `PrivateIsolated` (no outbound) |
| VPC endpoints            | API Gateway, CloudWatch Logs, Secrets Manager                       |
| ElastiCache              | Redis cluster (1 shard, 2 replicas, multi-AZ)                       |

### SSM Outputs

| Parameter            | Path                                               |
| -------------------- | -------------------------------------------------- |
| VPC ID               | `/{env}/flex-core/vpc`                             |
| Private Egress SG    | `/{env}/flex-core/security-group/private-egress`   |
| Private Isolated SG  | `/{env}/flex-core/security-group/private-isolated` |
| API Gateway Endpoint | `/{env}/flex-core/vpc-endpoint/api-gateway`        |
| Cache Endpoint       | `/{env}/flex-core/cache/endpoint`                  |

---

## Related

**FLEX:**

- [@platform/flex](/platform/infra/flex/README.md)
- [@platform/gov-uk-once](/platform/infra/gov-uk-once/README.md)
- [Platform Development Guide](/docs/platform-development.md)
