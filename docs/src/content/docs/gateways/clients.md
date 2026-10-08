---
title: Gateway clients
description: The REST and DynamoDB clients a gateway uses to reach its upstream, and mapApiResult for reshaping their results.
---

Clients are how a gateway reaches its upstream. The `clients` factory passed to `createHandler`
receives the resolved [resources](/flex/gateways/configuration/#resources) and returns the clients
by name. It runs once per request, and every route handler gets the same set on `clients`.

```ts
clients: ({ consumerConfig }) => ({
  api: createRestClient({
    baseUrl: consumerConfig.apiUrl,
    auth: { type: "public" },
  }),
  jwks: createRestClient({
    baseUrl: consumerConfig.wellKnownJwkUrl,
    auth: { type: "public" },
  }),
}),
```

| Client | Factory | Reaches |
| --- | --- | --- |
| REST | `createRestClient` | HTTP and JSON APIs |
| DynamoDB | `createDynamoDBClient` | One DynamoDB table |

Every client operation returns an `ApiResult`, so an upstream failure is a value, not an exception:

```ts
// Success
{ ok: true, status: 200, data: { key: "value" } }

// Failure
{ ok: false, error: { status: 404, message: "Not found", body: { /* upstream body */ } } }
```

A handler can return that result directly, and the gateway
[maps any failure](/flex/gateways/configuration/#upstream-error-mapping).

## REST client

`createRestClient`
([source](https://github.com/govuk-once/flex/blob/main/libs/service-gateway/src/client/adapter/rest.ts))
builds a client bound to one base URL.

| Option | Type | Description |
| --- | --- | --- |
| `baseUrl` | `string` | Prefixed to every path |
| `auth` | `RestAuth` | How requests are sent. See [Authentication](#authentication) |
| `headers` | `Record<string, string>` | Optional headers sent on every request |

The client has `get`, `post`, `put`, `patch` and `delete`. Each takes a path and an options object:

| Option | Methods | Description |
| --- | --- | --- |
| `query` | All | Query parameters, encoded onto the path |
| `headers` | All | Headers for this request. They override the client's headers |
| `schema` | All | A Zod schema for the response body. It validates the body and types `data`; without it `data` is `unknown` |
| `body` | `post`, `put`, `patch` | Sent as JSON |

```ts
const result = await api.get("/v1/example/path", {
  schema: RemoteResponseSchema,
  headers: { "x-api-key": consumerConfig.apiKey },
  query: { requiredService: "app" },
});

const created = await api.post("/v1/example/path", {
  schema: RemoteResponseSchema,
  body: { linkingId },
});
```

Every request sends `Accept: application/json`.

| Outcome | Result |
| --- | --- |
| A 2xx response that passes `schema` | `{ ok: true, status, data }` |
| A non-2xx response | `{ ok: false, error: { status, message, body } }`. `message` is the body's `message`, or the status text |
| A 2xx response that fails `schema` | `{ ok: false, error: { status: 422, message: "Response validation failed", body } }` |
| A network error after any retries | Thrown, so the gateway returns `500` |

A `schema` failure is a `422`, which the gateway passes to the caller as a client error. If an
upstream contract change should read as an upstream fault, validate with the route's `response`
schema instead, which returns `502`.

### Authentication

| `auth.type` | Behaviour |
| --- | --- |
| `"public"` | Plain HTTPS. Sends `Content-Type: application/json`. A request that fails with a network error is retried up to 3 times with backoff. HTTP error statuses are not retried |
| `"sigv4"` | Signs each request with SigV4 using credentials from an assumed role. Not retried |

A `sigv4` client takes these options as well:

| Option | Description |
| --- | --- |
| `region` | The region to sign for and to call STS in |
| `roleArn` | The role to assume |
| `roleName` | The STS role session name |
| `externalId` | Optional. The external ID the role's trust policy requires |

```ts
api: createRestClient({
  baseUrl: consumerConfig.apiUrl,
  auth: {
    type: "sigv4",
    region: consumerConfig.region,
    roleArn: consumerConfig.consumerRoleArn,
    roleName: "consumer-session",
    externalId: consumerConfig.externalId,
  },
  headers: { "Content-Type": "application/json" },
}),
```

The gateway needs `sts:AssumeRole` on the role, which a
[`role` resource](/flex/gateways/configuration/#resources) grants. Credentials are cached per role
and external ID for the life of the execution environment, and refreshed when they expire.

## DynamoDB client

`createDynamoDBClient`
([source](https://github.com/govuk-once/flex/blob/main/libs/service-gateway/src/client/adapter/dynamodb/client.ts))
binds one client to one table and one item schema. Every item read is parsed with the schema and
every item written is checked against it before it is sent, so a route works with typed items
rather than attribute maps.

```ts
clients: ({ consumerConfig }) => ({
  sources: createDynamoDBClient({
    table: consumerConfig.sourcesTableName,
    region: consumerConfig.region,
    schema: TravelSourceItemSchema,
    auth: {
      type: "role",
      roleArn: consumerConfig.roleArn,
      roleName: "travel-data-session",
      externalId: consumerConfig.externalId,
    },
  }),
}),
```

| Option | Description |
| --- | --- |
| `table` | The table name |
| `region` | The table's region |
| `schema` | The Zod schema for one item |
| `auth` | `{ type: "default" }` uses the Lambda's own credentials. `{ type: "role", roleArn, roleName, externalId? }` assumes a role, for a table in another account |

The VPC has no DynamoDB endpoint, so a gateway using this client needs `access: "private"` to reach
DynamoDB through the NAT gateway.

### Operations

| Operation | DynamoDB action | Returns | Notes |
| --- | --- | --- | --- |
| `scan` | Scan | `Item[]` | Reads the whole table or index, following pagination |
| `query` | Query | `Item[]` | Reads one item collection, following pagination |
| `get` | GetItem | `Item \| undefined` | A miss is `undefined`, not an error |
| `put` | PutItem | `Item` | Replaces any item with the same key, whole |
| `update` | UpdateItem | `Item` | Sets or removes the named attributes only, and returns the whole item. Creates the item if it does not exist |
| `delete` | DeleteItem | `void` | Succeeds whether or not the item existed |

```ts
// Every item in one collection, newest first, read from an index
const events = await eventsTable.query({
  indexName: "timestamp-query",
  key: { compositeKey: `${namespace}/${group}` },
  sort: "desc",
});

// One item, by its primary key
const source = await sourcesTable.get({ key: { sourceID } });

// The whole item, replacing whatever is there
const written = await sourcesTable.put({ item: source });

// Only the attributes named, leaving the rest of the item alone
const updated = await sourcesTable.update({
  key: { sourceID },
  set: { sourceEnabled: false },
  remove: ["deprecatedAttribute"],
});

await sourcesTable.delete({ key: { sourceID } });
```

### Keys, filters and updates

`key` names the primary key: the partition key attribute, and the sort key attribute if the table
has one. `query` can also take `indexName` and `sort` (`"asc"` or `"desc"`). `get`, `put`, `update`
and `delete` always act on the table, never an index.

`filter`, on `scan` and `query`, matches attributes by equality, with the entries joined by `AND`.
An attribute set to `undefined` is left out rather than matched against null.

```ts
await sourcesTable.scan({
  filter: { sourceNamespace: "travel", sourceEnabled: true },
});
```

A filter runs after DynamoDB has read the items and before it returns them, and the 1 MB read limit
applies before it. It trims the response; it does not save read capacity, and it is not a
substitute for a key or an index that selects the right items.

The client refuses some requests before sending them, rather than letting DynamoDB return a
`ValidationException`:

- a key with no attributes, or with more than two
- an update that sets and removes nothing
- an update that both sets and removes the same attribute
- an update that changes a key attribute

### Failures

No operation throws.

| Failure | Status in the result | What the caller of the gateway gets |
| --- | --- | --- |
| An item read fails the schema | `502` | `<NAME> upstream service unavailable`. The issues are logged |
| An item written fails the schema | `400` | `400` with `Item validation failed` and the failing attributes as `error` |
| A key or update the client refuses | `500` | `<NAME> upstream service unavailable`. The cause is logged |
| The table throttles the request | `429` | `429` with `Too many requests` |
| Any other AWS error | `502` | `<NAME> upstream service unavailable`. The error's name and message are logged |

AWS error messages never reach the caller. They are logged with the error name, so a denied
`AssumeRole` and a missing table can still be told apart in the logs.

### Adding an operation

Operations live one per file under
[`operations/`](https://github.com/govuk-once/flex/tree/main/libs/service-gateway/src/client/adapter/dynamodb/operations).
Each is a factory over a shared context: the table, the document client, `execute`, and the schema
parsers. Adding a batch, a transaction or a conditional write means a new factory and one line in
`createDynamoDBClient`. Telemetry, error mapping, validation and the `ApiResult` contract come from
`execute` and stay the same for every operation.

`@flex/service-gateway` also exports `createDynamoClient`, an earlier scan and query client that no
gateway uses. Use `createDynamoDBClient`.

## mapApiResult

`mapApiResult` transforms the `data` of a successful result and leaves a failed result as it is.
Use it when the route's response should differ from the upstream's shape.

```ts
import { mapApiResult } from "@flex/service-gateway";

const result = await api.get("/v1/groups", { schema: GroupsResponseSchema });

return mapApiResult(result, ({ data }) => data.groups);
```

The transform receives the upstream's parsed body. Here the upstream wraps its payload in a `data`
property, and the gateway returns only the groups.
