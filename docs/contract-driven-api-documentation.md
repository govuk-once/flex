# Contract-Driven API Documentation

Proposal for how FLEX domains define, share, and validate API contracts.

---

## The Problem

Today, API contracts live implicitly inside `domain.config.ts` as Zod schemas. This creates several issues:

- **Consumers can't read the contract** without understanding TypeScript and Zod
- **No single document** that both producer and consumer can review and agree on
- **Schema changes are invisible** — a developer changes a Zod schema and the consumer discovers the break at runtime
- **No standard format** for sharing API documentation with frontend teams, testers, or external stakeholders
- **Documentation is manual** — Confluence pages written by hand, which drift from the actual implementation

---

## The Approach

Split each domain into two source-of-truth files:

| File | Owned by | Contains | Format |
|------|----------|----------|--------|
| `openapi.json` | Both parties (agreed contract) | Routes, methods, schemas, access levels, headers, query params | OpenAPI 3.1.0 JSON |
| `platform.config.json` | Developer only | Resources, integrations, common settings, per-route wiring | JSON |

A generator merges them into the read-only `domain.config.ts` that the SDK consumes. No other code changes needed — the SDK, handlers, CDK, and tests all work as before.

### File Structure

Each domain is self-contained — contract, platform config, generated code, and handlers all in one place.

```
domains/dvla/
  contract/
    openapi.json                  ← contract (agreed between consumer and producer)
    schemas/
      driver.json                 ← one schema per file, composed via $ref
      licence.json
      view-driver-response.json   ← refs driver.json, licence.json, etc.
      ...
    routes/
      driving-licence.json        ← one route per file, refs schemas
      ...
  platform.config.json              ← infrastructure wiring (developer only)
  domain.config.ts                ← GENERATED (read-only, used by SDK)
  src/
    generated/
      schemas.ts                  ← GENERATED (Zod from contract JSON Schema)
    handlers/
      ...                         ← handler code (unchanged)

platform/domains/dvla/
  contract/
    external/
      driver-view.json            ← vendored external API spec
  src/
    contract/
      route.ts                    ← ROUTE_CONTRACTS (existing, stays as-is)
    ...

docs/                             ← aggregation package (CI/CD generates content)
  contracts/
    shared/
      errors.json                 ← shared error schemas referenced across domains
  api/                            ← GENERATED unified spec for /docs endpoint
  scripts/
    generate.ts                   ← discovers contracts from all domains, aggregates
```

### What Goes Where

**openapi.json** — everything the consumer cares about:

- Route paths and HTTP methods
- Request body and response schemas (JSON Schema)
- Query parameters and headers
- Path parameters
- Operation names
- Access level (`x-flex-access: "public"` or `"private"`)
- Error responses

**platform.config.json** — everything only the developer cares about:

- `resources` — SSM parameters, KMS keys, secrets
- `integrations` — upstream service calls (gateway/domain targets)
- `routeConfig` — which resources and integrations each route uses, keyed by `operationId` from the OpenAPI spec
- `common` — default access level, Lambda timeout, log level

### Why Two Files Instead of One

`domain.config.ts` currently mixes contract (what the API looks like) with infrastructure (how it's wired internally). This coupling means:

- Changing a schema requires editing the same file as changing an SSM path
- The consumer can't review the contract without seeing infrastructure details
- There's no way to diff "what changed in the API" vs "what changed in the wiring"

Splitting them makes each concern independently reviewable, diffable, and ownable.

---

## Generator Flow

```
contract/openapi.json + platform.config.json
            │
            ▼
        generator
            │
            ├── domain.config.ts                (SDK-compatible, read-only)
            ├── src/generated/schemas.ts         (Zod schemas, read-only)
            ├── contract/openapi.resolved.json   (single-file spec for external parties)
            └── docs/api/openapi.json            (unified spec for /docs endpoint)
```

The generator:

1. Reads `contract/openapi.json` — extracts routes, schemas, access levels, headers, query params
2. Resolves all `$ref` pointers and produces `openapi.resolved.json` (portable single file)
3. Converts JSON Schema → Zod via `json-schema-to-zod`
4. Reads `platform.config.json` — extracts resources, integrations, route wiring
5. Merges them into `domain.config.ts` matching the exact structure the SDK expects
6. Aggregates all domain specs into a single unified OpenAPI spec for /docs endpoint

---

## Breaking Change Detection

When a domain's `contract/openapi.json` changes on a PR, CI runs `oasdiff` to compare against main:

```
oasdiff breaking main:domains/dvla/contract/openapi.json branch:domains/dvla/contract/openapi.json
```

Breaking changes include:

- Removing an endpoint
- Removing a required field from a response
- Adding a required field to a request body
- Changing a field type
- Narrowing an enum (removing values)

If breaking changes are detected, CI fails. The developer must either:

1. Fix the contract to be non-breaking
2. Add a `breaking-change-acknowledged` label to the PR after communicating with consumers

Non-breaking changes (adding optional fields, new endpoints, widening enums) pass automatically.

---

## API Documentation Endpoint

A unified OpenAPI spec is generated from all domain `openapi.json` files and served via a platform-level `/docs` endpoint on API Gateway with Swagger UI. Teams visit one URL and can browse all domain APIs, switch between domains via a dropdown, and test endpoints directly.

The spec is updated on each deployment so documentation always reflects what is live.

---

## Why This Approach

### vs. Zod-first (current approach)

| | Zod-first | Contract-first |
|---|---|---|
| Source of truth | TypeScript code | OpenAPI JSON |
| Consumer can read it | No (needs TS/Zod knowledge) | Yes (standard format) |
| Breaking change detection | Not possible without generating a spec first | Direct diff with `oasdiff` |
| Sharing with external teams | Manual Confluence docs | Auto-generated Swagger UI |
| Schema reuse across languages | Not portable | JSON Schema is language-agnostic |
| Developer experience | Write Zod directly | Write JSON, Zod is generated |
| Runtime validation | Zod schemas | Same — generated Zod schemas validate at runtime |

### vs. AWS API Gateway Portal

API Gateway Portal is an alternative for documentation hosting. The `/docs` endpoint approach:

- Self-contained within the platform
- Updated automatically on deployment
- Accessible to anyone with platform access
- Can migrate to API Gateway Portal or Backstage later by pointing them at the same `openapi.json` files

### vs. Pact (consumer-driven contracts)

Pact requires consumers to generate pact files and a broker to coordinate. As discussed by the team, this adds complexity that isn't justified yet. The `oasdiff` approach gives producer-side contract validation without the full Pact setup. If the frontend team starts generating pacts in future, the `openapi.json` files provide the foundation.

---

## Generator

```bash
pnpm -w run generate
```

Reads all `domains/*/contract/openapi.json` + `domains/*/platform.config.json` and produces:
- `domains/*/domain.config.ts` — read-only, consumed by SDK
- `domains/*/src/generated/schemas.ts` — Zod from contract JSON Schema
- `docs/api/openapi.json` — unified spec for /docs endpoint

---

## Migration Path

1. Generate `openapi.json` for each existing domain from current Zod schemas
2. Create `platform.config.json` for each domain (extract resources, integrations, routeConfig)
3. Verify the generator produces identical `domain.config.ts` to the current one
4. Switch to contract-first workflow — edit `openapi.json` and `platform.config.json`, run generator
5. Add `oasdiff` to CI pipeline
6. Deploy unified spec to `/docs` endpoint on API Gateway

Existing domains migrate incrementally. New domains start contract-first from day one.

---

## Example: DVLA Domain

**Domain layer:**
- `domains/dvla/contract/openapi.json` — entry point with `$ref` to split schemas and routes
- `domains/dvla/contract/schemas/` — one JSON Schema file per data type
- `domains/dvla/contract/routes/` — one file per endpoint
- `domains/dvla/platform.config.json` — resources (SSM, KMS), integrations referencing contracts by operationId

**Service gateway layer:**
- `platform/domains/dvla/contract/external/` — vendored external API specs (from DVLA developer portal)
- `platform/domains/dvla/src/contract/route.ts` — ROUTE_CONTRACTS (existing, business logic stays human-written)

**Other domains:** `local-council`, `udp`, `uns` — each with `contract/openapi.json` and `platform.config.json` in their domain directory.
