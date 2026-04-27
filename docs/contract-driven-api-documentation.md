# Contract-Driven API Documentation

How FLEX domains define, share, and validate API contracts.

---

## The Problem

API contracts used to live implicitly inside `domain.config.ts` as Zod schemas. That created several issues:

- **Consumers can't read the contract** without understanding TypeScript and Zod
- **No single document** that producer and consumer both agree on
- **Schema changes are invisible** — a developer changes a Zod schema and the consumer discovers the break at runtime
- **No standard format** for sharing API documentation with frontend teams, testers, or external stakeholders
- **Documentation is manual** — Confluence pages written by hand, drifting from the implementation

---

## The Approach

Each domain has two source-of-truth files at its root:

| File | Owned by | Contains |
|------|----------|----------|
| `contract.json` | Both parties (agreed contract) | Routes, schemas, access levels, headers, query params, errors |
| `platform.json` | Developer only | Resources, integrations, common settings, per-route wiring |

A generator reads both, expands any FLEX shorthand to standard JSON Schema / OpenAPI, and writes the resolved standard OpenAPI spec for each domain to `docs/api/<domain>.json` for consumers.

### File Structure

```
domains/dvla/
  contract.json             ← agreed contract (consumer-facing)
  platform.json             ← infrastructure wiring (developer-facing)
  domain.config.ts          ← (existing) consumed by the SDK
  src/
    handlers/...            ← handler code (unchanged)

docs/
  api/
    dvla.json               ← GENERATED standard OpenAPI 3.1 (shared with consumers)
    udp.json
    uns.json
    local-council.json
  contracts/
    shared/
      errors.json           ← shared error schemas referenced across domains
  scripts/
    generate.ts             ← runs the mapper across every domain
    lib/
      flex-mapper.ts        ← FLEX shorthand → standard JSON Schema/OpenAPI
      flex-mapper.test.ts   ← every supported rule, asserted
```

### What Goes Where

**`contract.json`** — everything the consumer cares about:

- Routes (path, method, access level, request body, response, errors)
- Schemas (request/response data types)
- Operation names
- Default errors that apply to every route

**`platform.json`** — everything only the developer cares about:

- `resources` — SSM parameters, KMS keys, secrets
- `integrations` — upstream service calls (gateway/domain targets)
- `routeConfig` — which resources and integrations each route uses
- `common` — default access level, Lambda timeout, defaults that flow into every route

### Why Two Files

The previous approach mixed contract (what the API looks like) with infrastructure (how it's wired internally). Splitting them means:

- Schema changes are reviewed without infrastructure noise
- Consumers can read `contract.json` without seeing SSM paths
- Diffs cleanly answer "what changed in the API" vs "what changed in the wiring"

---

## Two Ways To Write Contracts

Both `contract.json` and `platform.json` accept **either standard JSON Schema / OpenAPI** or the **FLEX shorthand**, freely mixed inside the same file. The mapper detects which form a node is in and only expands the shorthand; standard JSON Schema passes through untouched.

This means:

- A consumer who only knows OpenAPI can read or write the standard form.
- A developer who wants something more compact can use the shorthand.
- A field that needs unusual constraints (e.g. `pattern`, `minLength`, `maxLength`, `oneOf`, `anyOf`) drops down into standard JSON Schema while neighbouring fields stay in shorthand.

### Why Shorthand

OpenAPI / JSON Schema is verbose. A required string is six lines. A nullable enum with five values is fifteen lines. The shorthand exists to make domain authors productive when 80% of fields are simple (`required string`, `optional integer`, `array of Foo`, `enum of three values`).

The shorthand is also intentionally *thin* — every shorthand token maps to standard JSON Schema. There's no FLEX-specific runtime behaviour. A consumer reading `docs/api/<domain>.json` sees nothing but vanilla OpenAPI.

### When To Use Each

| Situation | Use |
|---|---|
| Every field of a schema is simple | Shorthand |
| One field needs a regex pattern, length bound, or `oneOf` | Standard JSON Schema **for that field**, shorthand for the rest |
| You're hand-translating an external vendor spec | Standard (avoid loss of detail) |
| New domain you own end-to-end | Shorthand |

The mapper's pass-through rule for "standard schema" triggers as soon as a node contains `type`, `$ref`, `allOf`, `oneOf`, or `anyOf`. Anything else is treated as a shorthand object.

---

## FLEX Shorthand Reference

### Schemas

#### Primitive types

```json
"name": "string"
"age": "integer"
"price": "number"
"active": "boolean"
```

#### String formats

```json
"site": "url"
"birthday": "date"
"createdAt": "datetime"
"contact": "email"
"id": "uuid"
"slug": "slug"
```

#### Required vs optional

A `!` suffix on the **key** marks the field as required. No suffix = optional (matches JSON Schema's natural default).

```json
{
  "name!": "string",        ← required
  "nickname": "string"      ← optional
}
```

A `!` suffix on the **value** is shorthand for "required and non-empty" — for strings it also injects `minLength: 1`. You can use either form; using one is enough.

```json
"name!": "string"           ← required, minLength: 1
"name": "string!"           ← same result
```

#### Enums

```json
"status": "enum:active,inactive,banned"
```

Becomes:
```json
"status": { "type": "string", "enum": ["active", "inactive", "banned"] }
```

#### References to other schemas

A capitalised name is treated as a `$ref`:

```json
"address": "Address"
```

Becomes:
```json
"address": { "$ref": "#/components/schemas/Address" }
```

#### Arrays

Append `[]` to a primitive or a schema name:

```json
"tags": "string[]"
"drivers": "Driver[]"
```

Becomes:
```json
"tags": { "type": "array", "items": { "type": "string" } }
"drivers": { "type": "array", "items": { "$ref": "#/components/schemas/Driver" } }
```

#### Nested objects

Nest plain objects directly. The mapper recurses.

```json
"address": {
  "line1!": "string",
  "postcode": "string"
}
```

#### Composition / spread

Use the `"..."` key to spread another schema as `allOf`:

```json
"DerivedAuthority": {
  "...": "AuthorityFields",
  "extra": "string"
}
```

Becomes a JSON Schema `allOf` combining `AuthorityFields` with the inline object.

A spread-only schema (no extra fields) collapses to a plain `$ref`.

### Routes

A route key encodes method, path, and access level in one string:

```json
"GET /v1/driving-licence [public]": {
  "name": "get-users-drivers-licence",
  "summary": "...",
  "response": "ViewDriverResponse"
}
```

The mapper splits this into `paths["/v1/driving-licence"].get` with `x-flex-access: "public"`.

#### Response / body shorthand

```json
"response": "Driver"           ← becomes responses[200] with $ref
"response": "Driver[]"         ← becomes array response
"body": "CreateDriverBody"     ← becomes requestBody with $ref
```

#### Errors

```json
"errors": [400, 404, 502]
```

Each integer becomes a `responses[code]` entry with a stock description (`Bad request`, `Not found`, `Upstream service error`, …).

#### Default errors for the whole domain

```json
"x-flex-default-errors": [502]
```

Apply to every route that doesn't declare its own `errors` array.

### Platform

#### Resource shorthand

```json
"resources": {
  "gwUrl": "ssm:/flex/apigw/private/gateway-url:stage",
  "encryptionKey": "kms:/flex-secret/encryption-key",
  "hashSecret": "secret:/flex-secret/hash-secret"
}
```

Format: `<type>:<path>[:scope]` where `type` is `ssm`, `kms`, or `secret`.

#### Integration shorthand

```json
"integrations": {
  "dvlaAuthenticate": "gtw:dvla:GET /v1/authenticate",
  "udpGetLinkingId": "dom:udp:GET /v1/identity/*"
}
```

- `gtw:` and `gateway:` are equivalent (gateway calls).
- `dom:` and `domain:` are equivalent (domain-to-domain calls).
- Format: `<type>:<target>:<route>` or `<type>:<route>` if there's no separate target.

#### Common defaults

```json
"common": {
  "access": "private",
  "timeout": 30,
  "resources": ["gwUrl", "encryptionKey"],
  "integrations": ["dvlaAuthenticate"]
}
```

`timeout` is shorthand for `function: { timeoutSeconds: 30 }`. The `resources` and `integrations` arrays under `common` flow into every route in `routeConfig` automatically.

#### Per-route extension and override

```json
"routeConfig": {
  "get-customer-summary": {
    "+resources": ["extraKey"],     ← appends to common.resources
    "+integrations": ["extraCall"]  ← appends to common.integrations
  },
  "special-route": {
    "resources": ["onlyThis"],      ← replaces common.resources
    "integrations": ["onlyThat"]
  }
}
```

`+resources` / `+integrations` add to the common defaults; explicit `resources` / `integrations` replace them.

---

## Generator

```bash
cd docs && pnpm exec tsx scripts/generate.ts
```

Discovers every `domains/*/contract.json`, runs it through the mapper, and writes the resolved standard OpenAPI 3.1 spec to `docs/api/<domain>.json`.

The output files are what get shared with consumers — they're plain OpenAPI, no FLEX-specific tokens.

---

## Why This Approach

### vs. Zod-first (previous approach)

| | Zod-first | Contract-first |
|---|---|---|
| Source of truth | TypeScript code | JSON (OpenAPI / shorthand) |
| Consumer can read it | No (needs TS/Zod) | Yes (standard OpenAPI in `docs/api/`) |
| Sharing with external teams | Manual Confluence docs | Auto-generated OpenAPI files |
| Schema reuse across languages | Not portable | JSON Schema is language-agnostic |
| Developer experience | Write Zod directly | Write JSON, regenerate |

### vs. Pact (consumer-driven contracts)

Pact requires consumers to generate pact files and a broker to coordinate. That adds operational complexity and isn't justified for the current consumer set. Producer-side OpenAPI gives most of the value with none of the broker setup; if consumers later start producing pacts, the OpenAPI files are a clean foundation to reconcile against.

---

## Roadmap

The pieces below are intended but not yet implemented:

- **Generated `domain.config.ts` overlay** — replace the hand-written file with one generated from `contract.json` + `platform.json` so the SDK consumes the same single source of truth.
- **Generated Zod schemas** — `src/generated/schemas.ts` per domain, produced via `json-schema-to-zod`, used for runtime validation in handlers.
- **Unified `/docs` endpoint** — aggregate all `docs/api/*.json` into one spec served via Swagger UI on API Gateway.
- **`oasdiff` in CI** — fail PRs that introduce breaking contract changes unless the developer adds a `breaking-change-acknowledged` label.
- **External vendor specs** — vendored OpenAPI from upstream APIs (e.g. DVLA developer portal) under `platform/domains/<name>/contract/external/` for service gateway consumers.
