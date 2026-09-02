# Working in this repository

FLEX (Federated Logic and Events eXchange System) is a multi-tenant serverless API platform
built with AWS CDK and TypeScript. Domain teams declare routes and resources in config; the
platform derives the infrastructure.

This file is for anyone — person or coding agent — making changes here. It is a router, not a
manual: it says where the real instructions live.

## Orientation

- **Package manager is pnpm** (`11.17.0`, pinned via `packageManager`). Never use `npm` or
  `yarn` — it will corrupt the lockfile.
- **Monorepo driven by nx.** The verify commands below run against affected projects only.
- Repository layout is in [`README.md`](README.md) under _Repository Structure_.

## Before you change something, read its guide

| Changing                             | Read first                                                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| A domain — routes, handlers, config  | [`docs/domain-development.md`](docs/domain-development.md)                                                           |
| Platform code, stacks, constructs    | [`docs/platform-development.md`](docs/platform-development.md)                                                       |
| **Anything in `docs/architecture/`** | [`docs/architecture/explorer/README.md`](docs/architecture/explorer/README.md)                                       |
| Deployment or environments           | [`docs/deployment.md`](docs/deployment.md)                                                                           |
| Logging, redaction, telemetry        | [`docs/log-redaction.md`](docs/log-redaction.md), [`docs/telemetry-events-guide.md`](docs/telemetry-events-guide.md) |
| Anything, before opening a PR        | [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md)                                                                 |

## The architecture docs have a hard rule

`docs/architecture/` is its own workspace package, `@flex/architecture-docs`. It owns its
build scripts, its dependencies and its own `lint`/`tsc`/`test` targets, and it reads the FLEX
source through one declared contract — the `source` block in `explorer/explorer.config.json`
— so it can be lifted into a separate repository without untangling anything.

It builds a single generated page from a [LikeC4](https://likec4.dev)
model in `docs/architecture/explorer/model/` — the `.c4` files are the diagrams, with
`views.json` for presentation and `resources.json` for the AWS inventory. Edit those, never
`explorer.html` — it is overwritten.

The JSON is linted like any other file — eslint checks it with `prettier/prettier`, so run
`pnpm exec eslint --fix` on a file you edit before building.

The contract is [`docs/architecture/explorer/README.md`](docs/architecture/explorer/README.md).
**Read it before touching a view.** It leads with the rule that matters most there:

> Never carry a claim forward on trust. Read the code that proves it, every time.

A verification pass over an earlier draft found 80 of 1,091 claims wrong or misleading. Every
one looked plausible. So every claim names the files that prove it, and `pnpm architecture:build`
fails — it does not warn — on counts that disagree with the configs, an alarm table that no
longer matches the CDK constructs, a citation pointing at a file that has moved, text that will
not fit, or a claim about a resource that does not exist.

## Verify your work

```bash
pnpm lint            # nx affected --target=lint
pnpm tsc             # nx affected --target=tsc
pnpm test            # nx affected --target=test
```

Run all three before proposing a change — `docs/architecture/` is a workspace package, so it
is covered by them like any other. If you touched it, also run `pnpm architecture:build` and
`pnpm architecture:check`, which renders the page in headless Chromium and measures what static
validation cannot see. Both delegate to the package, so they can equally be run as
`pnpm --filter @flex/architecture-docs run build`.

**The architecture docs are also derived from code outside `docs/`.** Adding, removing or
renaming a CloudWatch alarm in `platform/infra/flex/src/constructs/alarms/` changes
`architecture-facts.json` and the Delivery table with it, so run `pnpm architecture:build` after
that too. CI watches that directory for the same reason.

## Conventions that bite

- **Commit messages** are `TICKET-000 type: description` — e.g.
  `FLEX-250 chore: platform service gateway cleanup`. Approved types and the full rules are in
  [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md).
- **New packages are quarantined for seven days.** `minimumReleaseAge: 10080` in
  `pnpm-workspace.yaml` blocks any version published more recently. If an install fails for a
  fresh release, that is why — pick an older version rather than lowering the setting.
- **Do not commit generated files.** `docs/architecture/explorer.html` and `docs/index.html`
  are gitignored — in `docs/architecture/.gitignore` and `docs/.gitignore`, next to what writes
  them rather than in the root — and built in CI. `docs/architecture/architecture-facts.json` is the exception:
  it is generated _and_ committed, so a config change that moves the route counts shows up as
  a reviewable diff.
