---
title: Feature flags
description: Declaring, attaching and reading feature flags.
sidebar:
  order: 6
---

A feature flag is a named boolean that a domain declares in `domain.config.ts`. A route lists the flags it uses, and its handler reads them from `featureFlags`. Use one to ship code that is switched off in some environments, such as a new response field that is only on in `development`.

Flags are not a remote service. They are worked out from the config and the Lambda's environment variables on each request, so changing a flag's value means changing the config and redeploying.

## Declare a flag

Declare flags once on the domain:

```ts title="domain.config.ts"
featureFlags: {
  enableItemMetadata: {
    description: "Include metadata in item responses",
    default: false,
    environments: ["development", "staging"],
  },
},
```

| Field          | Description                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `description`  | Optional. What the flag does.                                                                  |
| `default`      | Optional. The value when nothing else applies. Defaults to `false`.                            |
| `environments` | Optional. The environments where the flag is **on**: `development`, `staging` or `production`. |

`environments` is a list of where the flag is on, not a map of values. You can't use it to turn a flag off. See [How the value is decided](#how-the-value-is-decided).

## Attach it to a route

List the flags a route uses. Only these are read and passed to the handler:

```ts title="domain.config.ts"
routes: {
  v1: {
    "/items": {
      GET: {
        public: {
          name: "list-items",
          featureFlags: ["enableItemMetadata"],
        },
      },
    },
  },
},
```

TypeScript checks that every name is a declared flag. See [Route options](/flex/domains/domain-config/#route-options).

## Read it in the handler

A route that lists flags gets `featureFlags`, with a boolean for each:

```ts title="src/handlers/v1/items/get.ts"
export const handler = route(
  "GET /v1/items",
  async ({ featureFlags, logger }) => {
    const { enableItemMetadata } = featureFlags;

    logger.info("Listing items", { enableItemMetadata });
    // ...
  },
);
```

Used in: [`domains/example`](https://github.com/govuk-once/flex/blob/main/domains/example/domain.config.ts), with its [`list-todos` handler](https://github.com/govuk-once/flex/blob/main/domains/example/src/handlers/v0/todos/get.ts).

## How the value is decided

For each flag, the first rule that applies wins:

1. **An environment variable** with the same name as the flag. `"true"` turns the flag on. Any other value turns it off.
2. **`environments`** includes the current environment, so the flag is on.
3. **`default`**, if it is set.
4. Otherwise, `false`.

| `default` | `environments`               | `development` | `staging` | `production` |
| --------- | ---------------------------- | ------------- | --------- | ------------ |
| not set   | not set                      | off           | off       | off          |
| `false`   | `["development"]`            | on            | off       | off          |
| `false`   | `["development", "staging"]` | on            | on        | off          |
| `true`    | `["development"]`            | on            | on        | on           |

The last row shows why `environments` can't turn a flag off: `default: true` is on everywhere. Leave `default` out, or set it to `false`, and list the environments where the flag should be on.

The current environment is the stage the Lambda is deployed to, read from `FLEX_ENVIRONMENT`, which the platform sets on every deployed Lambda. Personal and `pr-<n>` stages count as `development`.

### Environment variables

A flag's variable has the same name as the flag, such as `enableItemMetadata`. Set it with `function.environment` in the config. That is a fixed value for every environment the route deploys to, so it overrides `environments`. Use it to force a flag on or off for a route, not to vary it by environment.

Flag names share the Lambda's environment variable names with [resources](/flex/domains/domain-config/#resources), so a flag and a resource can't have the same name.

Flags are read from the Lambda's environment on each request. So an environment variable changed by hand on a deployed Lambda, such as in the AWS console, changes the flag without a deploy. Don't rely on this. CloudFormation doesn't know about the change, so a later deploy that updates that function may overwrite it. Make the change in `domain.config.ts` instead.

## Testing a flag

Unit tests run as `development`, so a flag that lists `development` is on by default. Use the `env` fixture to set a flag for one test. It sets an environment variable named after the flag, and puts it back after the test:

```ts title="src/handlers/v1/items/get.test.ts"
describe("GET /v1/items", () => {
  it("includes metadata when the flag is on", async ({ env, sdk }) => {
    env.set({ enableItemMetadata: "true" });

    const result = await handler(sdk.event.get("/items"), sdk.context());

    // ...
  });

  it("leaves metadata out when the flag is off", async ({ env, sdk }) => {
    env.set({ enableItemMetadata: "false" });
    // ...
  });
});
```

Test both values. See [Testing](/flex/domains/testing/) for the other fixtures.

Used in: [`domains/example/src/handlers/v0/todos/get.test.ts`](https://github.com/govuk-once/flex/blob/main/domains/example/src/handlers/v0/todos/get.test.ts).
