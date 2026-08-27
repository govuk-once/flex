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
pnpm architecture:facts     # derive counts from the domain and gateway configs
pnpm architecture:build     # facts + validate every view + assemble explorer.html
pnpm architecture:check     # render in headless Chromium and check the geometry
```

`architecture:build` runs the facts step first, so it is the only one you normally need.

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
It covers the 9 route and domain counts; counts sourced from CDK code — alarms, keys, subnets
— are verified by hand.

---

## Change it

The content of every tab is JSON in [`explorer/views/`](/docs/architecture/explorer/views/) —
one file per tab. Edit those. Never edit `explorer.html`; it is generated and overwritten.

Authoring that JSON is the one step that is not automated, and deliberately so. It is the step
that requires reading the CDK stacks, the domain configs and the SDK to work out what is
actually true — judgement, not transformation. Everything downstream of it is deterministic
TypeScript that runs the same way on any machine and in CI.

| Step                            | Automated?                               |
| ------------------------------- | ---------------------------------------- |
| Author and verify the view JSON | No — this is the judgement step          |
| Derive counts from the configs  | `architecture:facts` — locally and in CI |
| Validate and assemble the page  | `architecture:build` — locally and in CI |
| Render and check the geometry   | `architecture:check` — locally and in CI |
| Publish to Pages                | `actions/deploy-pages` — CI only         |

Whatever you use to author the JSON — by hand, or with a coding agent — its output is a diff
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

So each fact in the view JSON carries a `code` array naming the files that prove it. When you
change a fact, re-verify it against those files rather than trusting the previous author.

---

## CI

[`.github/workflows/architecture-docs.yml`](/.github/workflows/architecture-docs.yml) runs on
changes to `docs/`, `domains/`, `platform/domains/` or the build scripts. It regenerates the
facts and fails if the committed copy is stale, runs the build and the render check, then
publishes `docs/` to GitHub Pages from `main`.

> Pages must be configured with **Source: GitHub Actions**, not a branch — `explorer.html` is
> gitignored, so a branch-based Pages build would publish a page with no explorer in it.
