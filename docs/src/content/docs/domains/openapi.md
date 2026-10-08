---
title: OpenAPI
description: How each domain's OpenAPI document is generated from its configuration, served and published, and how pull requests are checked for breaking changes.
---

Each domain has an OpenAPI 3.1 document generated from its `domain.config.ts`. The app team
builds against it. Nobody writes it by hand: the routes, schemas and headers in the configuration
are the source, so the document changes when the configuration does.

## Generating the documents

```bash
pnpm openapi:generate
```

[`scripts/generateOpenapi.ts`](https://github.com/govuk-once/flex/blob/main/scripts/generateOpenapi.ts)
loads every `domains/*/domain.config.ts` and writes one document per domain to
`dist/openapi/current/<domain>.json`, named after the directory, with an `index.json` that lists
them. It empties the directory first. The output is never committed. `pnpm run deploy` runs the
generator before it deploys.

Each document has an operation for each route:

| Part of the operation | Comes from |
| --- | --- |
| Path | `/app/<domain>/<version><path>`, with `:param` written `{param}` |
| `operationId` | The route's `name` |
| `summary` | The method and path, such as `GET /todos/:id` |
| Path parameters | Each `:param` segment, as a required string |
| Header parameters | Each declared header, with its `required` value |
| Request body | The `body` schema, as required JSON |
| Query parameters | The `query` schema |
| `200` response | The `response` schema, or a `200` with no content when there is none |

The document shows only the `200` response, whatever status the handler returns, and no error
responses. The error body every route can return is described in
[Error responses](/flex/domains/handlers/#error-responses).

When a method is both public and private, the document describes the private declaration, which
usually carries the fuller contract. Private-only routes are included too, under the same `/app/`
prefix, although the app cannot call them.

## Naming schemas

By default the generator writes each Zod schema out in full wherever it is used, so a schema used
by three operations appears three times. To make it a reusable component, give it an id with
Zod's `.meta()`:

```typescript
export const ShareCodeSchema = z
  .object({
    state: z.enum(["cancelled", "valid"]),
    tokenId: z.uuid(),
  })
  .meta({ id: "ShareCode" });

export const SingleShareCodeResponseSchema = z
  .object({
    linkingId: z.uuid(),
    shareCode: ShareCodeSchema,
  })
  .meta({ id: "SingleShareCodeResponse" });
```

The generator, through `zod-openapi`, adds each schema with an id to `components.schemas` once
and refers to it with `$ref: "#/components/schemas/<id>"` everywhere it is used, nested uses
included. Schemas without an id are still written out in full. No registration step is needed.

Use a PascalCase id that matches the type name a consumer would use, without a `Schema` suffix.
Give an id to any schema that:

- more than one operation uses
- is exported as a named constant
- is complex enough that a reader is better off seeing it once in `components.schemas`

`.meta()` can also carry a `description` and an `example`, which appear in the document.

## Viewing the documents locally

```bash
pnpm openapi:generate
pnpm docs:serve
```

`docs:serve` serves Swagger UI and the generated documents at `http://localhost:4400/docs/`. Set
`DOCS_PORT` to use another port. Run `openapi:generate` again after changing a configuration.

## The hosted API documentation

Every stage publishes its documents. When the `<stage>-FlexGlobal` stack deploys, it copies Swagger
UI and the contents of `dist/openapi/current` to the stage's OpenAPI bucket, which CloudFront
serves at `/docs/` on the stage's own domain name, beside the API. A CloudFront Function redirects
`/docs` to `/docs/` and serves `index.html` there. See
[CloudFront Functions](/flex/edge/cloudfront-functions/).

## The breaking change check

The **Validate OpenAPI Spec** workflow runs on every pull request to `main`. It:

1. generates the documents for the pull request
2. downloads the documents last deployed to the `development` stage, from its OpenAPI bucket
3. compares each pair with [oasdiff](https://github.com/oasdiff/oasdiff) and lists every
   breaking change at error level, such as a removed operation or a new required parameter
4. fails if it found a breaking change, or if a domain's document has gone

A document with nothing deployed to compare against, such as a new domain's, is skipped.

When a breaking change is intended, for example because the app no longer uses the operation,
add the `breaking-change-accepted` label to the pull request. The workflow runs again when a
label is added or removed, reports the breaking changes as accepted, and passes. Agree the change
with the app team first: the label stops the check, not the effect on the app.

To run the check yourself, install `oasdiff`, sign in to the development account (see
[AWS credentials](/flex/start/environment-setup/#aws-credentials)) and run:

```bash
pnpm openapi:generate
pnpm exec tsx scripts/checkOpenapiBreaking.ts
```

Set `OVERRIDE=true` to see what the label would do.
