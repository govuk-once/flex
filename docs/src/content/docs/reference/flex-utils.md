---
title: "@flex/utils"
description: The shared helpers, Zod schemas and types in @flex/utils.
---

`@flex/utils` lives in `libs/utils`. It holds the helpers, Zod schemas and types that the other
packages share: `@flex/sdk` and `@flex/service-gateway` build their request pipelines from it, the
CDK app reads its environment helpers, `@flex/testing` builds its fixtures on it, and domains and
gateways use its schemas and types.

Everything is exported from the one entry point:

```typescript
import { NonEmptyString, sanitiseStageName, type DeepPartial } from "@flex/utils";
```

The package's scripts are `lint`, `tsc` and `test`, plus the [sample OpenAPI document](#sample-openapi-document)
scripts.

## Environments and stages

[`src/environments.ts`](https://github.com/govuk-once/flex/blob/main/libs/utils/src/environments.ts) and
[`src/infra/index.ts`](https://github.com/govuk-once/flex/blob/main/libs/utils/src/infra/index.ts).
Stages and environments are described in [Environments](/flex/delivery/environments/).

| Export | Description |
| --- | --- |
| `EnvironmentSchema` | Zod enum of the persistent environments: `development`, `staging`, `production`. |
| `Environment` | The enum's values as an object (`Environment.staging`), and the union type of them. |
| `Stage` | Type: an `Environment` or any other string, such as a personal or `pr-<number>` stage. |
| `isPersistentEnvironment(stage)` | `true` when the stage is one of the three environments. Narrows `stage` to `Environment`. |
| `isStageAllowed(environments, stage)` | `true` for any non-persistent stage. For a persistent one, `true` when `environments` is `undefined` or contains it. `@flex/sdk` uses it to decide whether a domain or route is deployed to a stage. |
| `getEnvConfig()` | Returns `{ env, stage, persistent }` for the current process, from `STAGE` or else `USER`. Throws when neither is set. See [Infrastructure](/flex/infrastructure/overview/). |
| `sanitiseStageName(value?)` | Lowercases the value, removes everything but `a-z`, `0-9` and `-`, and keeps the first 12 characters. Returns `undefined` for an empty or missing value. `sanitiseStageName("Jane.Smith-Dev")` returns `"janesmith-de"`. |
| `findProjectRoot(startDir?)` | Walks up from `startDir` (default `process.cwd()`) to the directory holding `pnpm-workspace.yaml`. Throws if there is none. |
| `getStackOutputs(stackName, region?)` | Reads a CloudFormation stack's outputs into a `Record<string, string>`. `region` is `eu-west-2` (default) or `us-east-1`. On failure it throws a new `Error` that carries only the error's name, message and request ID, with the original as `cause`. |

## Errors

[`src/errors`](https://github.com/govuk-once/flex/tree/main/libs/utils/src/errors). The error
response contract these build is described once, in
[Error responses](/flex/domains/handlers/#error-responses).

| Export | Description |
| --- | --- |
| `ErrorResponseSchema`, `ErrorResponse` | Zod schema and type of the error body: `message`, `type` and optional `errors`. |
| `ErrorTypeSchema`, `ErrorType` | `auth_error`, `validation_error`, `client_error` or `server_error`. |
| `ErrorDetailSchema`, `ErrorDetail` | One entry of `errors`: `{ field, message }`. |
| `buildErrorResponse(type, message, errors?)` | Builds an `ErrorResponse`. Leaves out `errors` when the list is missing or empty. |
| `toErrorResponseBody(status, error?)` | Turns whatever a handler or upstream returned into an `ErrorResponse`. A string becomes the message. An object keeps a string `message`, an `errors` array and any other fields, except that `type` is replaced. When there is no message, the default for the status is used: `Internal server error` for 5xx, `Unauthorized` for 401 and 403, otherwise `Request failed`. The type comes from `errorTypeForStatus`. |
| `errorTypeForStatus(status)` | `auth_error` for 401 and 403, `server_error` for 500 and above, otherwise `client_error`. |
| `headersToErrorDetails(headers)` | One `ErrorDetail` per header name, with the message `Required header missing`. |
| `zodIssuesToErrorDetails(issues)` | One `ErrorDetail` per Zod issue. `field` is the issue path joined with `.`. |
| `HeaderValidationError` | Thrown by `resolveHeaders`. `statusCode` is `400`, and `headers` lists the missing header names. |
| `RequestBodyParseError` | Thrown by `resolveRequestBody`. `statusCode` is `400`. |
| `QueryParametersParseError` | Thrown by `resolveQueryParams`. `statusCode` is `400`, and `errors` holds the Zod issues as `ErrorDetail`s. |
| `isClientError(status)` | `true` for 400 to 499. |
| `isServerError(status)` | `true` for 500 and above. |
| `assertNever(value)` | For the unreachable branch of an exhaustive `switch`. A compile error if a case is missed, and throws if reached. |

## Request parsing

The request pipelines in `@flex/sdk` and `@flex/service-gateway` use these to build a handler's
context from an API Gateway event. The `resolve*` functions return `undefined` when there is nothing
configured to resolve.

| Export | Description |
| --- | --- |
| `resolveHeaders(requestHeaders, headerConfigs?)` | Looks up each configured header by its `name`, ignoring case, and trims its value. Returns the values keyed by the configuration's keys. A header is required unless its configuration sets `required: false`. Throws `HeaderValidationError` listing every missing required header. |
| `mergeHeaders(common?, overrides?)` | Merges two header configurations. Keys in `overrides` win. |
| `resolveRequestBody(body, schema?)` | Parses the body as JSON and validates it with the schema. An empty body is validated as `undefined`. Throws `RequestBodyParseError` for invalid JSON or a failed validation. |
| `resolveQueryParams(query, schema?)` | Validates the query string parameters, or `{}` when there are none. Throws `QueryParametersParseError`. |
| `resolvePathParams(params)` | The path parameters without any `undefined` values. |
| `validatePathParams(schema, params, contextName?)` | Validates path parameters with a schema, for a handler that does not use `@flex/sdk`. Logs the failure and throws a `400 Bad Request` from `http-errors`. |
| `getHeader(event, name)` | Reads one header from an API Gateway event, ignoring case. |

## Paths and route keys

[`src/path`](https://github.com/govuk-once/flex/tree/main/libs/utils/src/path). `@flex/service-gateway`
uses these to match requests to routes.

| Export | Example |
| --- | --- |
| `splitRouteKey(key)` | `"GET /v1/users"` → `["GET", "/v1/users"]`. `null` unless the key has both a method and a path. |
| `splitVersionedPath(path)` | `"/v1/users/me"` → `["v1", "/users/me"]`. `null` if there is nothing after the version. |
| `stripPathPrefix(path, prefix)` | Removes `prefix` only on a segment boundary: `("/gateways/udp/v1", "/gateways/udp")` → `"/v1"`, while `("/gateways/udpx", "/gateways/udp")` is returned unchanged. Returns `"/"` if nothing is left. |
| `splitPathSegments(path)` | `"/users/:id"` → `["users", ":id"]`. Empty segments are dropped. |
| `joinPathSegments(segments)` | `["users", "123"]` → `"/users/123"`. |
| `matchPathSegments(route, request)` | Matches segment by segment. A route segment `:name` captures the request segment. `(["users", ":id"], ["users", "123"])` → `{ id: "123" }`. `null` when they do not match. |
| `isCanonicalPath(path)` | `true` when the path has a leading slash and no empty segments or trailing slash. |

## HTTP

[`src/http`](https://github.com/govuk-once/flex/tree/main/libs/utils/src/http) and
[`src/response`](https://github.com/govuk-once/flex/tree/main/libs/utils/src/response).
`@flex/testing` builds its E2E client from these.

| Export | Description |
| --- | --- |
| `buildUrl(baseUrl, path, params?)` | Builds a `URL`. The path is appended to the base URL's own path, so `buildUrl("https://example.com/app", "/users")` gives `https://example.com/app/users`. `params` become the query string. |
| `extractQueryParams(params?)` | Returns `[searchString, record]`. An array value repeats the key in the search string. The record keeps the last value of each key. |
| `buildRequest(url, method, options?)` | Builds a `Request` with `Content-Type: application/json`, the headers given, and the body serialised as JSON when it is not `null` or `undefined`. Of the other options, only `signal` is used. |
| `parseResponseBody(response)` | `undefined` for a 204, a `content-length` of `0` or an empty body. Parsed JSON when the content type includes `application/json`, falling back to the text if it does not parse. Otherwise the text. |
| `jsonResponse(statusCode, body?)` | An API Gateway result with `Content-Type: application/json` and the body serialised as JSON. A falsy body is left out. |
| `QueryParams` | Type: values are a string, number or boolean, or an array of them. |
| `HttpRequestOptions` | Type of the options the `@flex/testing` E2E client takes: `body`, `headers`, `params` and `signal`. |
| `BuildRequestOptions` | Type of the options `buildRequest` takes: `body`, `headers` and the other `RequestInit` fields. |

```typescript
import { buildRequest, buildUrl, parseResponseBody } from "@flex/utils";

const url = buildUrl("https://api.example.com", "/users", {
  page: 1,
  filter: ["active", "admin"],
});
// https://api.example.com/users?page=1&filter=active&filter=admin

const response = await fetch(buildRequest(url, "GET"));
const body = await parseResponseBody<{ id: string }[]>(response);
```

## Schemas

[`src/schemas/common.ts`](https://github.com/govuk-once/flex/blob/main/libs/utils/src/schemas/common.ts).
Each schema is a Zod 4 schema. Where a type of the same name exists, it is the schema's output
type.

| Schema | Accepts |
| --- | --- |
| `Uuid` | A UUID. |
| `Url` | A URL. |
| `IsoDateTime` | An ISO 8601 date and time. |
| `Jwt` | A string in JWT format. |
| `NonEmptyString` | A string of at least one character. |
| `WholeNumber` | An integer. |
| `Slug` | Lowercase words joined by single hyphens, such as `driving-transport`. |
| `TraceId`, `RequestId` | A UUID, with OpenAPI metadata. |
| `Authorization` | `Bearer ` followed by a JWT. |
| `TracingHeaders` | `{ "x-trace-id", "x-request-id" }`. |
| `AuthenticatedHeaders` | `TracingHeaders` plus `authorization`. No type is exported. |
| `ApiGatewayUrlSchema` | An `https://{id}.execute-api.{region}.amazonaws.com` URL. The type is `ApiGatewayUrl`. |
| `UserId` | A `NonEmptyString` branded `UserId`, so a plain string cannot be passed where a user ID is expected. |
| `HeaderConfigSchema` | A header configuration: `{ name, required? }`. The type is `HeaderConfig`. |
| `RouteKeySchema` | A route key, `METHOD /path`, with `GET`, `POST`, `PUT`, `PATCH` or `DELETE`. |
| `RouteAccessSchema` | `public`, `private` or `isolated`. The type is `RouteAccess`. |
| `LogLevelSchema` | `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `SILENT` or `CRITICAL`. The type is `LogLevel`. |
| `HttpMethodSchema` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` or `OPTIONS`. The type is `HttpMethod`. |
| `ResourceScopeSchema` | `environment` or `stage`. The type is `ResourceScope`. |

What header configurations, route keys, access levels and resource scopes mean is covered in
[Domain configuration](/flex/domains/configuration/) and [Resources](/flex/domains/resources/).

## Types

[`src/types/index.ts`](https://github.com/govuk-once/flex/blob/main/libs/utils/src/types/index.ts).

| Type | Description |
| --- | --- |
| `DeepPartial<T>` | Every property optional, recursively. Functions are kept as they are. |
| `Simplify<T>` | Resolves intersections and mapped types recursively, so editors show the plain shape. |
| `Prettify<T>` | The same, one level deep. |
| `WithoutSuffix<T, Suffix>` | A string type without the suffix: `WithoutSuffix<"userId", "Id">` is `"user"`. |
| `WithoutPropSuffix<T, Suffix>` | An object type with the suffix removed from every key, recursively. |
| `NumberUpTo<N>` | The union `0 \| 1 \| … \| N - 1`. |
| `NumberBetween<From, To>` | The union of `From` up to, but not including, `To`. |
| `Branded<T, Brand>` | `T` with a type-only brand. |
| `ExtractPathParams<Path>` | The parameter names in a path: `ExtractPathParams<"/users/:id/posts/:postId">` is `"id" \| "postId"`. |
| `Json` | Any JSON value. |
| `ReadonlyRecord<K, V>` | `Readonly<Record<K, V>>`. |

## Sample OpenAPI document

`src/openapi` holds a hand-written OpenAPI document for `GET /example` and `GET /topics`, built
with `zod-openapi` from the schemas in `src/schemas/domain`. The package also exports those
schemas (`HelloWorldInput`, `HelloWorldOutput`, `TopicId`, `TopicRef`, `GetTopicsInput`,
`GetTopicsOutput`) and operations (`getHelloWorld`, `getTopics`), though nothing else uses them.

| Command | Does |
| --- | --- |
| `pnpm --filter @flex/utils generate-oas` | Writes the document to `src/openapi/api.json`, which Git ignores. |
| `pnpm --filter @flex/utils swagger` | Generates it and serves it with Swagger UI on port 4200. |
| `pnpm --filter @flex/utils scalar` | Generates it and serves it with Scalar on port 4200. |

This is not the platform's API description. That is generated from the domain configurations; see
[OpenAPI](/flex/domains/openapi/).
