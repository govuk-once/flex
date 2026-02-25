# @flex/utils

Shared utilities, schemas and types for FLEX.

---

## Commands

Run these from the repository root:

| Command                             | Description                  |
| ----------------------------------- | ---------------------------- |
| `pnpm --filter @flex/utils lint`    | Lint files                   |
| `pnpm --filter @flex/utils scalar`  | Serve OpenAPI docs (Scalar)  |
| `pnpm --filter @flex/utils swagger` | Serve OpenAPI docs (Swagger) |
| `pnpm --filter @flex/utils tsc`     | Run type check               |

Alternatively, run `pnpm <command>` from within `libs/utils/`.

## API

### HTTP

| Name                                        | Description                            | Code                               |
| ------------------------------------------- | -------------------------------------- | ---------------------------------- |
| [`buildUrl`](#buildurl)                     | Build URL with query parameters        | [View](./src/http/url.ts)          |
| [`buildRequest`](#buildrequest)             | Build a fetch Request object           | [View](./src/http/request.ts)      |
| [`parseResponseBody`](#parseresponsebody)   | Parse response body by content type    | [View](./src/http/request.ts)      |
| [`extractQueryParams`](#extractqueryparams) | Convert params object to search string | [View](./src/http/query-params.ts) |

### Infrastructure

| Name                                      | Description                            | Code                         |
| ----------------------------------------- | -------------------------------------- | ---------------------------- |
| [`sanitiseStageName`](#sanitisestagename) | Sanitise stage names for AWS resources | [View](./src/infra/index.ts) |

### Schemas

| Name                   | Description                            | Code                            |
| ---------------------- | -------------------------------------- | ------------------------------- |
| `Uuid`                 | UUID string schema                     | [View](./src/schemas/common.ts) |
| `Url`                  | URL string schema                      | [View](./src/schemas/common.ts) |
| `IsoDateTime`          | ISO 8601 datetime schema               | [View](./src/schemas/common.ts) |
| `Jwt`                  | JWT string schema                      | [View](./src/schemas/common.ts) |
| `NonEmptyString`       | Non-empty string schema                | [View](./src/schemas/common.ts) |
| `Slug`                 | Lowercase slug schema                  | [View](./src/schemas/common.ts) |
| `TraceId`              | UUID for distributed tracing           | [View](./src/schemas/common.ts) |
| `RequestId`            | UUID for request correlation           | [View](./src/schemas/common.ts) |
| `Authorization`        | Bearer JWT authorisation header schema | [View](./src/schemas/common.ts) |
| `TracingHeaders`       | Tracing headers object schema          | [View](./src/schemas/common.ts) |
| `AuthenticatedHeaders` | Tracing headers with authorisation     | [View](./src/schemas/common.ts) |
| `ApiGatewayUrlSchema`  | AWS API Gateway URL schema             | [View](./src/schemas/common.ts) |

### Types

| Name                  | Description                                                            | Code                               |
| --------------------- | ---------------------------------------------------------------------- | ---------------------------------- |
| `QueryParams`         | Query parameter object type                                            | [View](./src/http/query-params.ts) |
| `HttpRequestOptions`  | Options for HTTP requests                                              | [View](./src/http/request.ts)      |
| `BuildRequestOptions` | Options for `buildRequest`                                             | [View](./src/http/request.ts)      |
| `DeepPartial`         | Recursive partial type utility                                         | [View](./src/types/index.ts)       |
| `WithoutSuffix`       | Remove a specific suffix from a string type                            | [View](./src/types/index.ts)       |
| `WithoutPropSuffix`   | Remove a specific suffix from all keys in an object type recursively   | [View](./src/types/index.ts)       |
| `Simplify`            | Simplify a type by resolving intersections and flattening mapped types | [View](./src/types/index.ts)       |

---

## `buildUrl`

Build a URL with optional query parameters.

### Usage

```typescript
import { buildUrl } from "@flex/utils";

const url = buildUrl("https://api.example.com", "/users");
// https://api.example.com/users

const urlWithParams = buildUrl("https://api.example.com", "/users", {
  page: 1,
  filter: ["active", "admin"],
});
// https://api.example.com/users?page=1&filter=active&filter=admin
```

---

## `buildRequest`

Build a fetch `Request` object with JSON body support.

Automatically sets `Content-Type: application/json` when a body is provided.

### Usage

```typescript
import { buildRequest, buildUrl } from "@flex/utils";

const url = buildUrl("https://api.example.com", "/users");

const request = buildRequest(url, "POST", {
  body: { name: "John" },
  headers: { "X-Custom-Header": "value" },
});

const response = await fetch(request);
```

---

## `parseResponseBody`

Parse a fetch `Response` body based on content type.

Returns `undefined` for 204 responses or empty bodies. Parses JSON when content type is `application/json`, otherwise returns raw text.

### Usage

```typescript
import { parseResponseBody } from "@flex/utils";

const response = await fetch(request);
const body = await parseResponseBody(response);
```

---

## `extractQueryParams`

Convert a params object to a URL search string and key-value object.

Array values are expanded into repeated parameters. The returned object contains only the last value for each key.

### Usage

```typescript
import { extractQueryParams } from "@flex/utils";

const [searchString, paramsObject] = extractQueryParams({
  page: 1,
  filter: ["active", "admin"],
});

// searchString: "page=1&filter=active&filter=admin"
// paramsObject: { page: "1", filter: "admin" }
```

---

## `sanitiseStageName`

Sanitise a stage name for use in AWS resource names.

Converts to lowercase, removes non-alphanumeric characters (except hyphens), and truncates to 12 characters.

### Usage

```typescript
import { sanitiseStageName } from "@flex/utils";

sanitiseStageName("my-long-STAGE-name"); // "my-long-stag"
```

---

## `getValidatedSecret`

Retrieves a secret from AWS Secrets Manager, parses the JSON string, and validates the structure using a [Zod](https://zod.dev/) schema.

### Usage

```typescript
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { getValidatedSecret } from "@flex/utils";
import { z } from "zod";

const client = new SecretsManagerClient({});
const ConfigSchema = z.object({
  apiKey: z.string(),
  port: z.number(),
});

const config = await getValidatedSecret(
  client,
  "prod/app-config",
  ConfigSchema,
);

// config is typed and validated
console.log(config.apiKey);
```

---

## `getValidatedParameter`

Retrieves a string value from AWS Systems Manager (SSM) Parameter Store.

### Usage

```typescript
import { SSMClient } from "@aws-sdk/client-ssm";
import { getValidatedParameter } from "@flex/utils";

const client = new SSMClient({});

const apiBaseUrl = await getValidatedParameter(
  client,
  "/config/external-api-url",
);

console.log(`Fetching from: ${apiBaseUrl}`);
```

---

## Related

**FLEX:**

- [@flex/handlers](/libs/handlers/README.md)
- [@flex/testing](/libs/testing/README.md)

**External:**

- [Zod](https://zod.dev/api)
