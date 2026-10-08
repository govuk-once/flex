---
title: Resources
description: How a domain reads SSM parameters, Secrets Manager secrets and KMS keys, when each is resolved, and the permissions it gets.
---

Resources are values that live in AWS and that a handler needs: SSM parameters, Secrets Manager
secrets and KMS keys. A domain declares each one once in `resources`, then names it on each route
that reads it. The platform grants that route's Lambda function access to it and gives the
handler its value in `resources`.

```typescript
export const { config, route } = domain({
  name: "my-domain",
  resources: {
    encryptionKeyArn: { type: "kms", path: "/flex-secret/encryption-key" },
    notificationSecret: { type: "secret", path: "/flex-secret/udp/notification-hash-secret" },
    privateGatewayUrl: { type: "ssm", path: "/flex/apigw/private/gateway-url", scope: "stage" },
    gatewaysRoot: { type: "ssm:runtime", path: "/flex/apigw/private/gateways-root", scope: "stage" },
  },
  routes: {
    v1: {
      "/user": {
        GET: {
          public: {
            name: "get-user",
            resources: ["encryptionKeyArn", "notificationSecret"],
          },
        },
      },
    },
  },
});
```

```typescript
export const handler = route("GET /v1/user", async ({ auth, resources }) => {
  const pushId = derivePushId(auth.pairwiseId, resources.notificationSecret);
  // ...
});
```

Every value in `resources` is a string.

## Resource types

| Type | Service | Resolved | The handler gets | Permission granted |
| --- | --- | --- | --- | --- |
| `kms` | KMS | At deploy | The key's ARN | Decrypt with the key |
| `ssm` | SSM Parameter Store | At deploy | The parameter's value | Read the parameter |
| `ssm:runtime` | SSM Parameter Store | At run time | The parameter's value | Read the parameter |
| `secret` | Secrets Manager | At run time | The secret's value | Read the secret |

The key you give a resource is also the name of an environment variable on the route's Lambda
function, so it must be a valid environment variable name and must not clash with another
variable on the function.

### Deploy-time resources

For `kms` and `ssm`, CloudFormation looks up the value when the stack deploys and writes it into
the environment variable. The handler reads it from there. A change to an `ssm` parameter does not
reach the function until the domain is deployed again.

### Run-time resources

For `secret` and `ssm:runtime`, the environment variable holds the secret's or parameter's name.
Middleware fetches the value when a Lambda instance starts, and caches it for the life of that
instance. Use `ssm:runtime` for a value that can change without a deploy: new instances pick up
the change. Use `secret` for anything sensitive.

## Paths and scope

`path` is the resource's name without its environment or stage prefix. The platform adds the
prefix from `scope`:

| Scope | Prefix | Example for `/flex/apigw/private/gateway-url` |
| --- | --- | --- |
| `environment` (the default) | `/<environment>` | `/development/flex/apigw/private/gateway-url` |
| `stage` | `/<stage>` | `/pr-123/flex/apigw/private/gateway-url` |

The environment is `development`, `staging` or `production`. A personal or PR stage uses
`development`, so it shares the development environment's values. Use `scope: "stage"` for a
value each stage has its own copy of, such as the URL of the stage's private API.

A `kms` resource names a key alias, and ignores `scope`: `path: "/flex-secret/encryption-key"`
looks up the alias `alias/<environment>/flex-secret/encryption-key`.

The secrets, parameters and keys must exist before the domain deploys. The platform imports them;
it does not create them. Most are created outside this repository.

## The private gateway URL

A domain with [integrations](/flex/domains/integrations/) must declare an `ssm` resource whose
path is `/flex/apigw/private/gateway-url`, with `scope: "stage"`. Any key will do: the SDK finds it
by its path. Every route that uses an integration must also name it in `resources`, so its
Lambda function has the value.

```typescript
resources: {
  privateGatewayUrl: {
    type: "ssm",
    path: "/flex/apigw/private/gateway-url",
    scope: "stage",
  },
},
```

## When a resource is missing

| Problem | When it fails |
| --- | --- |
| A route names a resource the domain does not declare | When the code compiles, and when the CDK app synthesizes |
| A `kms` key alias does not exist | When the CDK app synthesizes, which looks the alias up |
| An `ssm` parameter does not exist | When the stack deploys |
| A `secret` or `ssm:runtime` resource does not exist | On the request, with a `500` |
| The environment variable is not set, such as in a unit test | When the handler module loads |

Unit tests set deploy-time values in `vitest.config.ts` and pass run-time values to the test's
Lambda context. See [Testing](/flex/domains/testing/#resources-in-tests).
