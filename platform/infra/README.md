# Flex Platform Infrastructure

This directory contains the AWS CDK code responsible for defining and deploying the core infrastructure for the FLEX platform.

## Overview

The infrastructure is defined using the [CDK](https://aws.amazon.com/cdk/) and is organised into Stacks. The primary entry point for the CDK application is `./src/index.ts`.

A base stack, `GovUkOnceStack`, is used to enforce a consistent tagging policy across all resources, ensuring compliance and proper cost allocation.

## Stacks

There are two main stacks that comprise the platform:

- **`FlexCoreStack`**: Deploys the core networking infrastructure. This includes the VPC, public and private subnets, security groups, NAT gateways, and VPC endpoints.
- **`FlexPlatformStack`**: Deploys platform-level services, such as the API Gateway.

## Configuration & Deployment

Deployments are managed by "stages," which provide isolation between different environments. A stage name is automatically prefixed to all deployed resources.

There are two types of stages:

### 1. Persistent Environments (for CI/CD)

These are long-running environments like `development`, `staging`, or `production`. The stage name is determined by the `ENVIRONMENT` environment variable.

**Example: Deploy all stacks to the `development` environment**

```bash
ENVIRONMENT=development pnpm run deploy --all
```

**Example: Deploy only the `FlexCore` stack to `development`**

```bash
ENVIRONMENT=development pnpm run deploy development-FlexCore
```

### 2. Ephemeral Environments (for Developers)

To test changes without affecting a persistent environment, you can deploy a personal, temporary copy of the infrastructure. The stage name is determined by your local `USER` environment variable.

**Example: Deploy all stacks to an ephemeral environment based on your username**

```bash
pnpm run deploy --all
```

_(This will create stacks like `<your-user-name>-FlexCore`, etc.)_

**Example: Deploy only the `FlexPlatform` stack to your ephemeral environment**

```bash
pnpm run deploy $(whoami | tr -dc 'a-z')-FlexPlatform
```
