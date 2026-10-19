---
title: Route context
description: Reading a route's context from helpers and services with routeContext.
sidebar:
  order: 4
---

`routeContext` gives any function the context of the route that is running: the same `auth`, `integrations`, `logger` and so on that the handler receives. It saves passing those values down through every function call.

It's optional. Many handlers don't need it, and how far you split a handler up is your choice. The [examples below](#choosing-an-approach) go from a handler that doesn't need it to one where it helps most.

## How it works

`routeContext` is exported from `domain.config.ts`, alongside `route`. Give it the route key as a type argument, and call it from inside a function:

```ts
import { routeContext } from "@domain";

const context = routeContext<"GET /v1/items">;

async function getItems() {
  const { auth, integrations, logger } = context();
  // ...
}
```

- `context()` returns the same type as that route's handler context, so it only has what the route declares.
- Assigning `routeContext<"…">` to a constant at the top of a file is safe. It doesn't read anything until it's called.
- You must give the type argument. Without it, the return type is an error message, not a context.

The context is stored with Node's [`AsyncLocalStorage`](https://nodejs.org/docs/latest-v24.x/api/async_context.html) for the length of the handler's call. Calling `context()` anywhere else, such as at module level, throws `Route store is not available. Must be called within a route handler`:

```ts
const context = routeContext<"GET /v1/items">;

// Throws: there is no request in flight at module level
const { logger } = context();
```

:::caution
The type argument is only checked by TypeScript. At runtime `context()` returns the context of whichever route is running. If a helper names one route but is called from another, its types are wrong and properties it expects may be missing.
:::

### Where to declare the alias

You can declare the alias where you use it, as above, or once in `domain.config.ts` and export it:

```ts title="domain.config.ts"
export const { config, route, routeContext } = domain({
  // ...
});

export const getItemsContext = routeContext<"GET /v1/items">;
```

```ts title="src/services/items.ts"
import { getItemsContext } from "@domain";

export async function getItems() {
  const { integrations } = getItemsContext();
  // ...
}
```

Both work the same way. `routeContext` is a plain function, and the platform ignores extra exports from `domain.config.ts`. It only reads `config`.

- **In the file that uses it:** the alias sits next to the code that reads it. This is the usual choice, and what the examples below do.
- **In `domain.config.ts`:** several files share one alias, so the route key is written once. The cost is that `domain.config.ts` grows beyond configuration, and every alias names a route that has to be kept in step with the config.

## Choosing an approach

### 1. Everything in the handler

A handler that does one or two things doesn't need helpers. Take what you need from the handler's argument:

```ts title="src/handlers/v1/items/get.ts"
export const handler = route(
  "GET /v1/items",
  async ({ auth, integrations, logger }) => {
    const result = await integrations.getItems({
      headers: { "requesting-service-user-id": auth.userId },
    });

    if (!result.ok) {
      logger.error("Failed to get items", { status: result.error.status });

      throw new createHttpError.BadGateway();
    }

    return { status: 200, data: result.data };
  },
);
```

Used in: [`domains/topics/src/handlers/v1/topics/get.ts`](https://github.com/govuk-once/flex/blob/main/domains/topics/src/handlers/v1/topics/get.ts).

### 2. Helpers that take arguments

When a handler grows, split it into functions and pass each one what it needs. This is plain TypeScript, with no `routeContext`, and the helpers are easy to test on their own:

```ts title="src/handlers/v1/items/get.ts"
export const handler = route("GET /v1/items", async ({ auth, resources }) => {
  const itemKey = toItemKey(auth.userId, resources.itemSecret);

  return { status: 200, data: { itemKey } };
});

function toItemKey(userId: UserId, secret: string) {
  // ...
}
```

This works well while helpers need one or two values. It gets awkward once you're passing `integrations`, `logger` and `auth` through several layers.

Used in: [`domains/udp/src/utils/get-push-id.ts`](https://github.com/govuk-once/flex/blob/main/domains/udp/src/utils/get-push-id.ts), which takes the user id and secret as arguments.

### 3. Helpers that read the context

When helpers call integrations, log and call other helpers, have them read the context themselves. The handler reads as a list of steps:

```ts title="src/handlers/v1/items/get.ts"
import { route, routeContext } from "@domain";

const context = routeContext<"GET /v1/items">;

export const handler = route("GET /v1/items", async () => {
  const items = (await getItems()) ?? (await createDefaultItems());

  return { status: 200, data: { items } };
});

async function getItems() {
  const { auth, integrations, logger } = context();
  // ...
}

async function createDefaultItems() {
  const { auth, integrations, logger } = context();
  // ...
}
```

Used in: [`domains/udp/src/handlers/v1/users/me/get.ts`](https://github.com/govuk-once/flex/blob/main/domains/udp/src/handlers/v1/users/me/get.ts).

### 4. Services in their own directory

When the logic is large, or shared by several handlers, move it into `src/services/`. Each service reads the context itself, and the handler stays small:

```ts title="src/services/items.ts"
import { routeContext } from "@domain";

type CreateRoute = "POST /v1/items";
type DeleteRoute = "DELETE /v1/items/:id";

const createCtx = routeContext<CreateRoute>;
const writeCtx = routeContext<CreateRoute | DeleteRoute>;

export async function createItem(item: NewItem) {
  const { auth, integrations, logger } = createCtx();
  // ...
}

export async function removeItem(id: string) {
  const { integrations, logger } = writeCtx();
  // ...
}
```

```ts title="src/handlers/v1/items/post.ts"
import { route } from "@domain";
import { createItem } from "@services/items";

export const handler = route("POST /v1/items", async ({ body }) => {
  await createItem(body);

  return { status: 201 };
});
```

Add a path alias for the directory in the domain's `tsconfig.json`, such as `"@services/*": ["./src/services/*"]`.

Used in: [`domains/udp/src/services/identity.ts`](https://github.com/govuk-once/flex/blob/main/domains/udp/src/services/identity.ts), called from the handlers in [`domains/udp/src/handlers/v1/identity/[service]/`](https://github.com/govuk-once/flex/tree/main/domains/udp/src/handlers/v1/identity/%5Bservice%5D).

## Sharing a helper across routes

A helper called from more than one route can take a union of their keys:

```ts
const context = routeContext<"GET /v1/items" | "GET /v1/items [private]">;
```

The context then only has what **every** route in the union has. In this example there is no `auth`, because the private route doesn't have it, so the helper must take the user id as an argument instead. Mixing the two styles like this is normal.

## Testing

Test helpers and services that use `routeContext` through the handler that calls them. Outside a running handler there is no context, so calling them directly throws. Helpers that take arguments, as in [approach 2](#2-helpers-that-take-arguments), can be tested on their own.

See [Testing](/flex/domains/testing/).
