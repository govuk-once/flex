# Developer Reference

Common patterns, best practices and workflows when developing on FLEX.

---

## Handler Patterns

Domain handlers are built using the [@flex/sdk](/libs/sdk/README.md) package. The SDK provides a declarative configuration API and a typed handler factory that conditionally includes context properties based on the route definition.

See the [Domain Development Guide: Handler Patterns](/docs/domain-development.md#handler-patterns) for all handler examples including authentication, request body/query validation, path parameters, resources, integrations, headers and route context.

See [@flex/sdk](/libs/sdk/README.md) for full API reference on domain configuration, resources, integrations, headers and other configuration options.

## Testing

See [Domain Development Guide: Testing](/docs/domain-development.md#testing) for handler test setup, patterns and examples.

## Lambda Constructs

Lambda constructs are managed by the SDK based on the `access` field specified in your domain configuration. The table below is a reference for platform engineers maintaining the construct implementations.

### Choosing a Construct

| Construct                     | Internet Access | VPC Resources | Use Case                              |
| ----------------------------- | --------------- | ------------- | ------------------------------------- |
| `FlexPublicFunction`          | Yes             | No            | Simple handlers, public APIs          |
| `FlexPrivateEgressFunction`   | Yes (NAT)       | Yes           | Calling external APIs + VPC resources |
| `FlexPrivateIsolatedFunction` | No              | Yes           | Internal processing                   |

```text
Does your handler need to call external APIs?
├── Yes → FlexPrivateEgressFunction
└── No
    └── Does your handler need VPC resources?
        ├── Yes → FlexPrivateIsolatedFunction
        └── No → FlexPublicFunction
```

Domain developers set the `access` field on a route or in the domain configuration "common" options. The platform maps these values to the appropriate Lambda construct:

| Value        | Lambda                        |
| ------------ | ----------------------------- |
| `"public"`   | `FlexPublicFunction`          |
| `"private"`  | `FlexPrivateEgressFunction`   |
| `"isolated"` | `FlexPrivateIsolatedFunction` |

The default is `"isolated"` when no `access` value is specified.

### Entry Point Helpers

Use `getDomainEntry` for domain handlers and `getPlatformEntry` for platform handlers:

```typescript
import { getDomainEntry, getPlatformEntry } from "./utils/getEntry";

// Domain handler: domains/domain/src/handlers/handler/method.ts
getDomainEntry("domain", "handlers/handler/method.ts");

// Platform handler: platform/domains/domain/src/handler.ts
getPlatformEntry("domain", "handler.ts");
```

---

## API Documentation

FLEX supports bidirectional API contract workflows. Zod schemas in domain configs are the runtime source of truth and can generate OpenAPI specs. Conversely, an OpenAPI spec can scaffold a new domain with generated Zod schemas and config.

### Generating OpenAPI specs from domain configs (Zod → OpenAPI)

```bash
pnpm run generate-spec
```

This discovers all `domain.config.ts` files under `domains/`, extracts routes and Zod schemas, and outputs OpenAPI 3.1.0 JSON specs to `docs/api/`. Each domain gets its own file (e.g. `dvla.json`, `udp.json`) plus an `index.html` with Swagger UI for browsing.

Only domains using the `domain()` pattern are supported. Legacy `defineDomain()` domains are skipped.

The generator is incremental — it compares file modification times and only regenerates specs for domains whose config has changed. Use `--force` to regenerate all.

```bash
pnpm run generate-spec -- --force
```

#### Previewing locally

```bash
pnpm -w run docs:preview
```

This generates specs and serves them on `http://localhost:3000` with Swagger UI. Use the dropdown to switch between domains.

#### CI/CD

On merge to `main`, the `api-docs.yml` workflow regenerates all specs and deploys to GitHub Pages. The workflow triggers when domain configs, schemas, or the generator scripts change.

### Scaffolding a domain from an OpenAPI spec (OpenAPI → Zod)

```bash
pnpm -w run generate-domain --from spec.json --name my-domain
```

This creates:

- `domains/my-domain/domain.config.ts` — routes, methods, and schema references matching the FLEX `domain()` pattern
- `domains/my-domain/src/schemas/schemas.ts` — Zod schemas generated from the JSON Schema definitions in the spec, with `$ref` pointers resolved

If the domain already exists, both files are overwritten. Use `git diff` to review changes before committing.

Path parameters are converted from OpenAPI style (`{id}`) to Express style (`:id`). Routes are grouped by version prefix (e.g. `/v1/...`). Routes without a version default to `v1`.

#### Example

Given an OpenAPI spec with:

```json
{
  "paths": {
    "/v1/users/me/settings/topics": {
      "get": {
        "operationId": "get-topics",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/TopicsResponse" }
              }
            }
          }
        }
      }
    }
  }
}
```

The generator produces:

```typescript
// domain.config.ts
export const { config, route, routeContext } = domain({
  name: "topics",
  routes: {
    v1: {
      "/users/me/settings/topics": {
        GET: {
          public: {
            name: "get-topics",
            response: TopicsResponse,
          },
        },
      },
    },
  },
});
```

---

## Related

**FLEX:**

- [@flex/sdk](/libs/sdk/README.md)
- [@flex/logging](/libs/logging/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@flex/utils](/libs/utils/README.md)
- [@platform/flex](/platform/infra/flex/README.md)

**Guides:**

- [Environment Setup](/docs/environment-setup.md)
- [Platform Development Guide](/docs/platform-development.md)
- [Domain Development Guide](/docs/domain-development.md)
- [Deployment Guide](/docs/deployment.md)
- [Documentation Guide](/docs/documentation-guide.md)
