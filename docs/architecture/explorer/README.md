# Architecture Explorer — source

The source for `docs/architecture/explorer.html`: eight tabs, built to a single
self-contained page. This file is the contract. **Read it before changing a view** —
whether you are a person or an agent working on someone's behalf.

The built page is gitignored, because a 292KB generated blob makes for meaningless diffs.
CI builds it and publishes `docs/` to GitHub Pages on every merge to `main`; locally,
`pnpm architecture:serve` builds it for you.

`architecture-facts.json` **is** committed, at 24KB, for two reasons: a config change that
moves the route counts becomes a reviewable diff, and the build validates the diagram's own
counts against it — 9 route/domain counts, 36 assertions across the four stages. Add a route
and forget the diagram, and the build tells you the row, the stage and both numbers. The
other 73 counts come from CDK code rather than domain config and are still verified by hand.

---

## The rule that matters most

**Never carry a claim forward on trust. Read the code that proves it, every time.**

A verification pass over an earlier draft checked 1,091 claims in this explorer against the
repository and found **80** wrong or misleading — including five asserted on six tabs each.
Every one of them looked plausible. Plausibility is not evidence.

So: when you write a fact, cite the file that proves it in that item's `code` array. When you
edit an existing fact, re-verify it against those files rather than assuming the last author
was right. This applies no matter who the last author was.

---

## Build

```bash
pnpm architecture:build
```

That runs two steps:

1. **`pnpm architecture:facts`** loads every `domains/*/domain.config.ts` and
   `platform/domains/*/gateway.config.ts` — the same files the CDK app reads — and writes
   [`../architecture-facts.json`](../architecture-facts.json): route counts per domain, per
   stage, per access tier, service gateway routes and resources, and the domain dependency
   graph.
2. **`scripts/buildArchitectureExplorer.ts`** validates the view files and assembles them
   with the styles, markup and renderer into `explorer.html`.

### Never hand-write a number

If a count in a view disagrees with `architecture-facts.json`, **the view is wrong**. If the
generated file looks wrong, the config is the bug — not the diagram.

The build enforces this for the counts it can derive; the `DERIVED` map in
`buildArchitectureExplorer.ts` names them. Counts that come from CDK code rather than domain
config — alarms, keys, subnets, log groups — are not covered, so verify those against the
stack that creates them.

### The pipeline is deterministic

Authoring the view JSON is a judgement step: it means reading the CDK stacks and configs to
work out what is true. Everything downstream — deriving facts, validating, assembling,
rendering, publishing — is ordinary TypeScript that runs the same way on any machine and in
CI. Keep it that way. Whatever helps you author the JSON, its output is a committed diff that
gets reviewed like any other.

---

## Layout

| Path           | What it is                                                           |
| -------------- | -------------------------------------------------------------------- |
| `views/*.json` | One file per tab. This is the content — everything else is machinery |
| `styles.css`   | Presentation, including both colour themes                           |
| `shell.html`   | Page markup: header, canvas, inspector                               |
| `app.js`       | Renderer, edge routing, pan/zoom, inspector, stage selector          |

The page has to stay single-file: it is served straight from the docs folder and published as
a shareable artifact, and neither can fetch a sibling file.

---

## The view contract

Every node carries two orthogonal properties, and the build refuses to assemble a file that
gets them wrong.

**`kind`** is who owns it — the thing a reader must not get wrong:

| `kind`   | Meaning                                                        |
| -------- | -------------------------------------------------------------- |
| `person` | A human role                                                   |
| `flex`   | Owned by the FLEX platform                                     |
| `govuk`  | Inside the GOV.UK Once boundary                                |
| `third`  | Outside it — another government organisation, or a third party |

**`plane`** is whether it serves requests — `request` or `control`. Ownership is carried by
colour, plane by border style, so the two never compete.

### Tab order and grouping

`order` sets the position; `group` labels the section it sits in. The build rejects a missing
group, and rejects a group split across non-adjacent tabs.

The order is by **what a reader must already know**, not by size:

| Group         | Tabs                                          | Why here                                                                                             |
| ------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Architecture  | Context, Request path, Containers, Components | The C4 zoom ladder. Request path sits second because it introduces the vocabulary Containers assumes |
| Cross-cutting | Network, Security, Delivery                   | Each cuts across every container; all three assume you have read Containers                          |
| Reference     | Resources                                     | Lookup, and the drill-down target for every badge                                                    |

Size order would put Security third (16 boxes) ahead of Containers (21) — but Security
describes controls layered on containers you have not met yet. Dependency beats complexity.

### Every tab says who it is for

Each view file carries an `audience` string, shown next to the tab's blurb. The build refuses
a view without one. It exists so a reader can skip six tabs: a domain engineer needs
Components, an on-call engineer needs Request path and Delivery, an assurance reviewer needs
Security. Keep it to one line naming a role, not a description of the content.

Zones set `hard: true` for a real boundary (a region, the VPC, an ownership edge) and
`hard: false` for a visual grouping.

### Placeholders, not angle brackets

Write `{stage}`, `{domain}`, `{version}`, `{proxy+}` — **never** `<stage>`. Fact text is
rendered as HTML so that `<b>` and `<code>` work, which means a literal `<stage>` is parsed
as an unknown element and silently disappears. The build fails on any other angle bracket.

### The JSON is linted like any other file

`views/*.json` are committed files, and eslint checks JSON repo-wide with
`prettier/prettier` and `json/no-duplicate-keys`. A view that is valid JSON but badly
formatted still fails.

`pnpm architecture:build` checks the formatting itself, so you find out immediately rather
than in CI. When it complains:

```bash
pnpm exec eslint --fix docs/architecture/explorer/views/<file>.json
```

Two rules that follow from this, and matter if you are generating JSON rather than typing it:

- **Never hand-format.** Prettier collapses short arrays onto one line and has its own
  indent rules; a file written by `JSON.stringify(x, null, 2)` or by hand will not match.
  Write the file however you like, then run the `--fix` above before building.
- **`architecture-facts.json` formats itself.** `architectureFacts.ts` runs its output
  through prettier before writing, so the committed file is lint-clean by construction.
  If you change what it emits, keep that.

---

## Scope discipline

Each tab has one job. When adding something, ask what kind of thing it is:

- **Context** — runtime only. No build, deploy or ops.
- **Containers** — things separately deployable, runnable or storable. A Web ACL is policy
  attached to a container, not a container; the VPC is network. Their effect belongs as a
  fact on the box they guard.
- **Network / Security / Delivery** — the concerns that cut across every container.
- **Resources** — the inventory, and the drill-down target for every badge.

If a fact belongs to two tabs, one owns it and the other references it. Duplicated facts
drift; several already had.

### Reference tables

A diagram view may carry a `tables` array. They render in a strip under the drawing,
**collapsed by default** — the diagram is the point, the tables are the drill-down. Opening
one is remembered while you move between tabs.

Use a table when something is genuinely tabular and would be a poor diagram: rule numbers,
retention periods, derivations, an error contract. Do not start a parallel markdown document
for it — the C4 levels, AWS inventory, request sequences and deployment topology were retired
precisely because they became second copies of these tabs and drifted.

---

## What the build checks

`pnpm architecture:build` exits non-zero on:

- a view file that is not valid JSON, not prettier-formatted, or sharing an `id` with another
- a raw `<` or `>` in any string
- an unknown `kind` or `plane`, or a node narrower than 176px
- two node boxes overlapping, or a node straddling a zone edge
- text that will not fit its box
- an edge referencing a node that does not exist
- a `placement` entry naming a resource id that is not in `views/resources.json`
- a resource that no diagram places, so nothing links to it
- a derived count that disagrees with `architecture-facts.json`

Pass `--lenient` to report problems without failing, while iterating.

## Checking it renders

`pnpm architecture:build` validates the data. `pnpm architecture:check` renders the built page
in Chromium, light and dark, and measures what static validation cannot see — whether text
fits, whether a line clips a box it has nothing to do with, whether two labels overlap,
whether every clickable thing opens a populated panel, and whether the audience line survives
a selection.

It splits results in two:

- **Hard** — text that does not fit, a target opening an empty panel, a tab that lost its
  audience, any console error. Always a defect, always fails.
- **Soft** — a line clipping an unrelated box, a label on a box, two labels touching. A
  handful are unavoidable on the dense views. `SOFT_BUDGET` in the script is a ratchet: it
  may fall, never rise.

The browser binary is not in the lockfile, so on a clean machine:

```bash
pnpm exec playwright install chromium
```

---

## Changing a diagram

1. Edit the relevant `views/*.json`. That is the content; everything else is machinery.
2. `pnpm exec eslint --fix docs/architecture/explorer/views/<file>.json` — format it.
3. `pnpm architecture:build` — fix whatever it reports. It fails, it does not warn.
4. `pnpm architecture:check` for what static validation cannot see.
5. Open the page and check it reads well.
6. Cite the code for any claim you added or changed, in that item's `code` array.

```bash
# open the built page
open docs/architecture/explorer.html

# emit the same page without the html/head/body wrapper, for publishing
# as a shareable artifact
pnpm architecture:build --body /tmp/explorer-body.html
```

---

## Known defects the diagrams must not paper over

These are real and unfixed in the code. If you touch a tab that shows one, keep the
statement — do not quietly reword around it.

- The cross-region alarm relay has a syntax error in an inline handler, so every us-east-1
  edge alarm reaches nobody.
- `SmokeTestAlarm` has no alarm action.
- `local-council` declares gateway integrations to routes the udp gateway does not serve;
  `validate-integrations` only checks `type: "domain"`.
- No internal call path retries — `retryAttempts` is not in the integration schema.
- The Lambda environment CMK is read in a way that fails at deploy rather than synth.
