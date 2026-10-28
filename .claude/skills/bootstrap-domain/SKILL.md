---
name: bootstrap-domain
description: Use when someone wants to create, start, scaffold or bootstrap a new Flex domain under domains/ (e.g. "I want to start a new domain", "set up a domain for X"). Interviews the user for the decisions a domain needs, then scaffolds the package, first route, handler and tests, and verifies it builds. Not for adding a route to an existing domain.
---

# Bootstrap a Flex domain

Walk the user from "I want a new domain" to a package that type-checks, lints, passes its tests and synthesises. Interview first, scaffold second, verify third. Deploying is a separate step the user confirms.

## Sources of truth

Read these before scaffolding. Don't copy their content into chat; follow them.

1. **The first-domain guide**: `docs/src/content/docs/getting-started/your-first-domain.md`. This skill builds on it: same files, same order. If it isn't in this checkout yet (it lands with the docs site), fall back to `docs/domain-development.md`.
2. **Domain config reference**: `docs/src/content/docs/domains/domain-config.md` if present, else `libs/sdk/README.md`.
3. **The living example**: `domains/topics/`. When the guide and `topics` disagree on a dependency version or config file, `topics` wins, because it's what CI is passing today.

## 1. Interview

Ask as little as possible. Everything except the name has a default, so a user can go from "I want a new domain" to a plan in one exchange. Skip anything they've already told you, and never ask about things with a fixed convention (file layout, tsconfig, lint config, dependency versions).

**Ask, in one message:**

- **Domain name.** kebab-case, short, e.g. `travel`, `local-council`. This is the only answer with no default: it becomes the folder (`domains/<name>/`), the package (`@flex/<name>-domain`), the stack (`<stage>-<name>`) and the URL (`/app/<name>/...`). These must all match, and renaming after a deploy means a new stack. If the user has described the domain but not named it, suggest a name. Check that `domains/<name>/` doesn't already exist.
- **Purpose,** in a sentence, for the README. Accept "skip" and write a placeholder line.

**Then propose the plan with these defaults filled in:**

| Decision | Default | Notes |
| --- | --- | --- |
| First route | `GET /v1/hello` | No body, so it's easy to `curl`. Real routes come next, via the normal "add a handler" flow. |
| Route name | `get-hello` | For a custom route, `<method>-<path>`, e.g. `get-permit`. Must be unique in the domain. |
| Response | `{ message: "Hello from <name>" }` as `z.literal(...)` | Gives the hand-over message a predictable body to check. |
| Who calls it | `public` | The app calls it through CloudFront with a user token, and the handler gets `auth.userId`. It's the only kind you can try by hand. There is no anonymous public route. |
| Environments | `["development"]` | Staging and production are a deliberate promotion later. Personal and `pr-<n>` stages ignore this field. |
| Integrations | None | The most likely thing to break a first deploy. Add one as a second step. |
| E2E test | Yes | CI discovers domains by their `test:e2e` script. |
| `common.access` | `"isolated"` | The Lambda's network placement, not who can call the route. Right for almost every domain. |

Show the plan as a short summary, e.g.:

> `domains/parking/` with a public `GET /v1/hello` returning `{ message: "Hello from parking" }`, development only, no integrations, with an E2E test. Go ahead, or change anything?

Wait for a yes before writing files.

**If the user changes something, ask follow-ups only for that change:**

- **Their own route:** the method and path (`:param` segments allowed; version stays `v1` unless they say otherwise), plus the response shape, and the request body for `POST`/`PUT`/`PATCH`. Rough field lists are fine; you write the Zod.
- **`private` route:** warn that only other domains can call it, over SigV4, with no user identity, so it can't be tried with `curl`.
- **An integration:** which gateway (`platform/domains/`: `udp`, `uns`, `dvla`, `travel`) or domain (the `name` in `domains/*/domain.config.ts`), the exact upstream route (e.g. `GET /v1/topics`) and its response shape. Check the route against the target's config, because nothing else does.
- **Resources** (SSM, secrets, KMS): the key and the path for each.
- **`common.access`:** `"private"` only if the handler itself must call the internet. `"public"` can't use integrations, so push back on it.

## 2. Scaffold

Create `domains/<name>/` following the guide's step 2 file set. Copy `package.json`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts` and `vitest.e2e.config.ts` from `domains/topics/` and adapt them, rather than typing versions from memory.

- **`package.json`**: `"name": "@flex/<name>-domain"`. Keep exact pinned versions (no `^`/`~`). Keep the `test:e2e` script if they want E2E tests. Drop `exports` unless another package will import this domain's schemas.
- **`tsconfig.json`**: keep the `@domain` path alias. Add `@schemas/*` only if you create `src/schemas/`.
- **`vitest.config.ts`**: one `env` entry per declared resource. Keep the `AWS_*` test values and their `// pragma: allowlist secret` comments.
- **`domain.config.ts`**: `name` exactly matches the folder. Use `z.literal(...)` for fixed values in schemas and `NonEmptyString` from `@flex/utils` for required strings. Never assign a bare value to a schema field.
- **With integrations**: declare the private gateway URL resource with the path `/flex/apigw/private/gateway-url` and `scope: "stage"`, list it on the route alongside the integration, and add it to the `vitest.config.ts` `env`. Without it the Lambda throws at startup.
- **Handler** at `src/handlers/<version>/<path>/<method>[.private].ts`, with `:param` written as `[param]`. Import `route` from `"@domain"`. The route key matches the config exactly, with ` [private]` appended for private routes.
- **Unit test** next to the handler (`<method>[.private].test.ts`). Use `it` and `createUserId` from `@flex/testing`, build the event with `sdk.event.<method>`, and stub upstream calls with `http.gateway(...)` or `http.domain(...)`. Cover the happy path, plus one upstream-failure case when there's an integration.
- **E2E test** (if wanted) at `e2e/<name>.test.ts`, wrapped in `describe.runIf(isDomainDeployed(config))`. Include a 401-without-token case and an authenticated case using the `authHeader` fixture. The path is `/<name>/<version>/<path>`.
- **`README.md`**: follow the shape of `domains/topics/README.md` (summary, commands, handlers table, one section per route).

Gotchas this repo has hit before:

- Handlers outside `src/handlers/` fail at synth with `CannotFindEntryFile`.
- A folder name that differs from `name` fails the same way, because the entry path is built from `name`.
- Don't add type casts or `eslint-disable` comments for "unresolved type" errors. They mean `pnpm install` hasn't run, not that the code is wrong.
- A handler with no `await` fails `require-await`. Make it non-async rather than disabling the rule.
- A literal response field may need `as const` in the handler so it isn't widened to `string`.

## 3. Verify

Run from the repo root, and fix anything that fails before reporting:

```bash
pnpm install
pnpm --filter @flex/<name>-domain tsc
pnpm --filter @flex/<name>-domain lint
pnpm --filter @flex/<name>-domain exec vitest run
pnpm validate:integrations   # only if it integrates with another domain
```

The tests run with `vitest run` so they don't sit in watch mode. Then, if the user has AWS access, check the stack synthesises. This creates nothing in AWS:

```bash
cd platform/infra/flex
domain=<name> gds-cli aws once-bl-development-admin -r eu-west-2 npx cdk synth <stage>-<name> --quiet
```

The stage comes from `STAGE` or `$USER`: lowercased, `[a-z0-9-]` only, cut to 12 characters. If `gds-cli` prompts for MFA, ask the user to run the command themselves with a `!` prefix.

## 4. Hand over

End with a message in this shape, with every placeholder filled in from the interview and the user's stage. The URL, commands and route should be copy-pasteable as they stand. Don't deploy or generate a token yourself unless the user then asks.

````markdown
Your `<name>` domain is ready. Type-check, lint, unit tests and synth all pass.

**Created:** `domains/<name>/` with `GET /v1/<path>` (public) — <one-line summary of files>.

**See it working:**

1. Deploy it to your personal stack (takes a few minutes; also updates your shared platform stacks):
   ```bash
   domain=<name> gds-cli aws once-bl-development-admin -r eu-west-2 pnpm deploy
   ```
2. Generate a token for your stage, and copy just the token from the output:
   ```bash
   STAGE=<stage> gds-cli aws once-bl-development-admin -r eu-west-2 pnpm jwt
   ```
3. Send a GET request:
   ```bash
   curl -H "Authorization: Bearer <token>" \
     https://<stage>.development.bl.once.service.gov.uk/app/<name>/v1/<path>
   ```
   You should get `200` with `<expected body>`.

**Next:** add an E2E test run with `pnpm --filter @flex/<name>-domain test:e2e`, then open a PR titled `FLEX-<ticket> feat(<name>): <summary>` (`FLEX-000` if there's no ticket).
````

Adjust it to the route that was built:

- **Private route:** replace step 3 with a note that it can only be called by other domains over SigV4, and point to the unit test instead.
- **Non-GET route:** add `-X <METHOD> -H "Content-Type: application/json" -d '<example body>'`, with a body that matches the schema.
- **Path params:** fill them in with an example value.
- **Expected body:** what the handler returns for the request you show. If it depends on upstream data, describe the shape instead.

Things to get right in that message, all checked against a live stack:

- **Set `STAGE`:** `pnpm jwt` defaults to `STAGE=development`, not the user's stage.
- **The URL:** `https://<stage>.development.bl.once.service.gov.uk` is the `FlexApiUrl` output of `<stage>-FlexGlobal` (in `us-east-1`). Routes sit under `/app/<name>/`.
- **Expected errors:** `401 {"message":"Unauthorized","type":"auth_error"}` means a missing token or one from the wrong stage. A `404` usually means a wrong path or a deploy that hasn't finished.
