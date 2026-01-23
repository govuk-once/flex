# Flex Platform

This directory contains the code responsible for defining and deploying the infrastructure for the FLEX platform.

## Overview

```txt
platform/
├── infra/           # Flex platform infrastructure code
│   ├── core/        # Core infrastructure such as the VPC
│   ├── flex/        # Flex platform infrastructure
│   ├── gov-uk-once/ # Base class for stack to extend from
│   └── parameter/   # Infrastructure to store parameters into AWS
└── domains/         # Domains directory (application code for the platform)
```

> A base stack, `GovUkOnceStack`, is used to enforce a consistent tagging policy across all resources, ensuring compliance and proper cost allocation.

## Stacks

There are two main stacks that comprise the platform:

- **`FlexCoreStack`**: Deploys the core networking infrastructure. This includes the VPC, public and private subnets, security groups, NAT gateways, and VPC endpoints.
- **`FlexPlatformStack`**: Deploys platform-level services, such as the API Gateway.

## Configuration & Deployment

Deployments are managed by "stages," which provide isolation between different environments. A stage name is automatically prefixed to all deployed resources.

There are two types of stages:

### 1. Persistent Environments (for CI/CD)

These are long-running environments like `development`, `staging`, or `production`. The stage name is determined by the `STAGE` environment variable.

**Example: Deploy all stacks to the `development` environment**

```bash
STAGE=development pnpm run deploy
```

### 2. Ephemeral Environments (for Developers)

To test changes without affecting a persistent environment, you can deploy a personal, temporary copy of the infrastructure. The stage name is determined by your local `USER` environment variable.

**Example: Deploy all stacks to an ephemeral environment based on your username**

```bash
cd platform/infra/flex
pnpm run deploy
```

_(This will create stacks like `<your-user-name>-FlexPlatform`, etc.)_
