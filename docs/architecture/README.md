# FLEX Architecture

The architecture of **FLEX** is documented as one interactive page —
**[`explorer.html`](/docs/architecture/explorer.html)** — built from versioned source in
[`explorer/`](/docs/architecture/explorer/) and derived from the code in this repository
rather than from prior design documents.

This file covers how to **view** and **build** it. The architecture itself is in the explorer.

---

## View it

Published to GitHub Pages on every merge to `main`. To read it locally:

```bash
pnpm architecture:serve      # builds, then serves http://localhost:4321
```

Eight tabs, in three groups. Every box, line and zone is clickable; resource counts update
when you switch stage.

| Tab              | Group         | Who it is for                                                    |
| ---------------- | ------------- | ---------------------------------------------------------------- |
| **Context**      | Architecture  | Anyone new to FLEX, including non-engineers                      |
| **Request path** | Architecture  | On-call, and anyone tracing a live request                       |
| **Containers**   | Architecture  | Platform engineers, and anyone reviewing a change                |
| **Components**   | Architecture  | Domain teams — this is the part you write                        |
| **Network**      | Cross-cutting | Platform engineers, and network or security review               |
| **Security**     | Cross-cutting | Security review, assurance and threat modelling                  |
| **Delivery**     | Cross-cutting | Platform engineers and on-call                                   |
| **Resources**    | Reference     | Cost, audit and incident scoping — the detail behind every badge |

---

## Build it

```bash
pnpm architecture:facts     # derive counts from the domain and gateway configs, and the alarms
pnpm architecture:build     # facts + validate every view + assemble explorer.html
pnpm architecture:check     # render in headless Chromium and check the geometry
```

`architecture:build` runs the facts step first, so it is the only one you normally need.

These are a convenience: this folder is its own workspace package, `@flex/architecture-docs`,
and each one delegates to it. `pnpm --filter @flex/architecture-docs run build` is the same
command, and `lint`, `tsc` and `test` run there too — so the docs are covered by the
repository-wide `pnpm lint` / `pnpm tsc` / `pnpm test` like any other package.

### It reads FLEX through one declared contract

The package owns everything under `docs/architecture/`. Everything it reads from the rest of
the repository is declared in one place — the `source` block of
[`explorer/explorer.config.json`](/docs/architecture/explorer/explorer.config.json):

```json
"source": {
  "root": "../..",
  "domainConfigs": "domains/*/domain.config.ts",
  "gatewayConfigs": "platform/domains/*/gateway.config.ts",
  "alarmConstructs": "platform/infra/flex/src/constructs/alarms"
}
```

`root` is where the FLEX checkout is, relative to this folder; today that is the repository
these docs sit in. When the docs move to their own repository and pull FLEX in beside them,
that one field changes and nothing else does — every read goes through it, resolved in
[`scripts/lib/paths.ts`](/docs/architecture/scripts/lib/paths.ts). Point it somewhere without
a FLEX checkout and the build says so by name rather than quietly producing an empty page.

One caveat worth knowing before that move: the domain and gateway configs are **imported** as
modules, so the checkout they live in has to have its dependencies installed. The alarm
constructs are read as text and parsed, so they need nothing. If a plain checkout is ever all
that is available, the configs are the part that would need FLEX to publish
`architecture-facts.json` as an artifact instead.

**`explorer.html` is generated and gitignored** — it is built in CI and published from there.
`architecture-facts.json` **is** committed, so a config change that moves the route counts
shows up as a reviewable diff.

### What the build refuses to produce

The build fails rather than emitting a page with a known defect: label text overflowing its
box, boxes overlapping or straddling a zone edge, an edge pointing at a node that does not
exist, a view with no stated audience, a raw `<` that would silently swallow the rest of a
label — and a route or domain count that disagrees with the generated facts.

That last one is the anti-drift gate: add a route to a domain, forget the diagram, and the
build names the row, the stage, the number claimed and the number the configs actually say.
It covers the 10 route and domain counts read from the configs, and the 18 CloudWatch alarms
parsed out of `platform/infra/flex/src/constructs/alarms/` — rename an alarm there and the
docs build fails until the Delivery table matches. Counts still sourced from CDK code by
hand — keys, subnets, endpoints — are not gated, so they are verified by reading the stacks.

Every reference table also names the files it was transcribed from, and the build fails on a
citation pointing at a file that no longer exists.

---

## Change it

The diagrams are a [LikeC4](https://likec4.dev) model in
[`explorer/model/`](/docs/architecture/explorer/model/) — one `.c4` file per tab. Edit
those. Never edit `explorer.html`; it is generated and overwritten.

The model is a standard, so the same file gives three levels of detail: a plain C4 tool
gets boxes and arrows via `likec4 codegen`, `likec4 start` gets the full model with its own
layout, and this explorer adds the verified facts, hand-placed layout and per-stage counts
it keeps in `metadata`.

Authoring that model is the one step that is not automated, and deliberately so. It is the step
that requires reading the CDK stacks, the domain configs and the SDK to work out what is
actually true — judgement, not transformation. Everything downstream of it is deterministic
TypeScript that runs the same way on any machine and in CI.

| Step                           | Automated?                               |
| ------------------------------ | ---------------------------------------- |
| Author and verify the model    | No — this is the judgement step          |
| Derive counts from the configs | `architecture:facts` — locally and in CI |
| Validate and assemble the page | `architecture:build` — locally and in CI |
| Render and check the geometry  | `architecture:check` — locally and in CI |
| Publish to Pages               | `actions/deploy-pages` — CI only         |

Whatever you use to author the model — by hand, or with a coding agent — its output is a diff
that lands in a pull request and gets reviewed like any other. Nothing non-deterministic runs
in the pipeline, so anyone can run and debug the whole thing locally.

### Before you change a view

Read **[`explorer/README.md`](/docs/architecture/explorer/README.md)**. It is the contract:
the node properties, the tab-order rationale, the scope rules that keep a fact on exactly one
tab, every gate the build enforces, and the known code defects the diagrams must not paper
over. It leads with the rule that matters most:

> **Never carry a claim forward on trust.** Read the code that proves it, every time.

That rule was earned. A verification pass over an earlier draft checked 1,091 claims against
the repository and found **80** wrong or misleading — five of them repeated across six tabs
each. Every one looked plausible.

So every claim names the files that prove it: elements and relationships carry LikeC4 `link`
statements, and reference tables carry a `code` array. When you change a fact, re-verify it
against those files rather than trusting the previous author.

---

## CI

[`.github/workflows/architecture-docs.yml`](/.github/workflows/architecture-docs.yml) runs on
changes to `docs/`, `domains/`, `platform/domains/`, the alarm constructs, or the build
scripts. It regenerates the
facts and fails if the committed copy is stale, runs the build and the render check, then
publishes `docs/` to GitHub Pages from `main`.

> Pages must be configured with **Source: GitHub Actions**, not a branch — `explorer.html` is
> gitignored, so a branch-based Pages build would publish a page with no explorer in it.
