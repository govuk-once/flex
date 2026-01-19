# @flex/testing

> Shared test utilities and fixtures for testing AWS Lambda handlers with HTTP API events

## Available Commands

```bash
pnpm run lint
pnpm run test
```

## Usage

Add to your package's `devDependencies`:

```json
{
  "@flex/testing": "workspace:*"
}
```

### Basic Usage

Import `it` and base mocks from `@flex/testing`:

```typescript
import { context, it } from "@flex/testing";
import { describe, expect } from "vitest";

describe("GET /example handler", () => {
  it("returns 200 with hello world message", async ({ event }) => {
    const response = await handler(event.get("/example"), context);

    expect(response).toEqual({
      statusCode: 200,
      body: JSON.stringify({ message: "Hello, World!" }),
    });
  });
});
```

### Two Approaches

**Base mocks via imports** — for simple cases with no customisation:

```typescript
import { context, event } from "@flex/testing";

const response = await handler(event, context);
```

**Fixtures via test context** — for HTTP helpers or custom overrides:

```typescript
import { it } from "@flex/testing";

it("using fixtures", async ({ event, context }) => {
  const response = await handler(
    event.get("/example"),
    context.create({ functionName: "custom-name" }),
  );

  // ...
});
```

## Available Fixtures

### `event`

HTTP request builder for `APIGatewayProxyEventV2`. Supports all standard HTTP methods:

| Method   | Signature                                    | Body Required |
| -------- | -------------------------------------------- | ------------- |
| `create` | `(overrides?) => APIGatewayProxyEventV2`     | No            |
| `get`    | `(path, options?) => APIGatewayProxyEventV2` | No            |
| `post`   | `(path, options) => APIGatewayProxyEventV2`  | Yes           |
| `put`    | `(path, options) => APIGatewayProxyEventV2`  | Yes           |
| `patch`  | `(path, options) => APIGatewayProxyEventV2`  | Yes           |
| `delete` | `(path, options?) => APIGatewayProxyEventV2` | No            |

#### `event.create`

Create an `APIGatewayProxyEventV2` event with optional overrides:

```typescript
it("example", async ({ event }) => {
  // Base event
  const base = event.create();

  // With overrides
  const custom = event.create({
    rawPath: `/custom/path/${id}`,
    requestContext: { http: { method: "POST" } },
    body: JSON.stringify({ key: "value" }),
    // ...
});
```

#### Options

##### `headers`

Supports any key/value pairs of strings.

```typescript
event.get("/example", {
  headers: {
    "Content-Type": "application/json",
  },
});
```

##### `params`

Supports primitives and arrays. Arrays create repeated query parameters.

> **Note:** `queryStringParameters` stores only the last value for duplicate keys. Use `rawQueryString` if you need to access all values associated with a key

```typescript
event.get("/example", {
  params: { page: 1, filter: ["owner", "status"], enabled: true },
});

// rawQueryString: "page=1&filter=owner&filter=status&enabled=true"
// queryStringParameters: { page: "1", filter: "status", enabled: "true" }
```

##### `body`

Accepts an object containing any key/value pairs.

- Required for POST/PUT/PATCH

```typescript
event.post("/example", {
  body: {
    key: "value",
    a: "b",
  },
});

// body: "{"key":"value","a":"b"}"
```

```typescript
// valid - body not required for GET/DELETE
event.get("/example");
event.delete(`/example/${id}`);
```

You can provide a type to ensure `body` matches a specific shape:

```typescript
interface Body {
  key: string;
}

// valid
event.post<Body>("/example", {
  body: { key: "value" },
});

// invalid
event.post<Body>("/example", {
  body: {
    key: "value",
    a: "b",
    c: "d",
  },
});
```

You can also provide an inferred type (e.g. from a zod schema):

```typescript
const handlerRequestBodySchema = z.object({ message: z.string() });
type HandlerRequestBody = z.output<typeof handlerRequestBodySchema>;

event.post<HandlerRequestBody>("/example", {
  body: { message: "hello world" },
});
```

### `context`

Lambda `Context` object.

**Base import** — sensible defaults, no customisation:

```typescript
import { context } from "@flex/testing";

const response = await handler(event, context);
```

**Fixture** — with optional overrides:

```typescript
it("example", async ({ context }) => {
  // Base context
  const base = context.create();

  // With overrides
  const custom = context.create({
    functionName: "my-function",
    awsRequestId: "custom-request-id",
    // ...
});
```
