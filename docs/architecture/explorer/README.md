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

A resource row says where its own count comes from, with a `from` field beside the `n` it
governs — `"from": "totals.routeMethods.public"`, a dotted path into the generated facts.
The build resolves it and fails when the two disagree. Keeping the claim and its source in
the same object means a renamed or deleted row takes its mapping with it. Counts that come from CDK code rather than domain
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

| Path                   | What it is                                                           |
| ---------------------- | -------------------------------------------------------------------- |
| `explorer.config.json` | Everything specific to this project — see below                      |
| `views/*.json`         | One file per tab. This is the content — everything else is machinery |
| `styles.css`           | Presentation, including both colour themes                           |
| `shell.html`           | Page markup: header, canvas, inspector                               |
| `app.js`               | Renderer, edge routing, pan/zoom, inspector, stage selector          |
| `icons.svg`            | AWS service icons as `<symbol>` defs — see below                     |

The page has to stay single-file: it is served straight from the docs folder and published as
a shareable artifact, and neither can fetch a sibling file.

---

## What belongs to this project

`explorer.config.json` holds everything that is true of FLEX rather than of the explorer:

| Field              | What it does                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `title`, `tagline` | The browser tab and the header brand                                                                          |
| `docsTitle`        | Heading on the generated `docs/index.html` landing page                                                       |
| `repo`             | Base URL that every `code` citation links against                                                             |
| `slug`             | Prefixes exported filenames and browser-storage keys                                                          |
| `inventoryView`    | Which view is the resource inventory — `resources` here                                                       |
| `iconLabel`        | Names the service-icon control, for readers and screen readers                                                |
| `filterHint`       | Placeholder in the Resources filter box                                                                       |
| `kinds`            | The ownership kinds: `id`, `label`, and the palette `colour` each uses                                        |
| `stages`           | The stage selector: `id`, `label`, and `facts` — the name the same stage goes by in `architecture-facts.json` |

Nothing about presentation is in here — colours live in `styles.css` — and nothing that
duplicates a view: a resource's `from` sits on the resource. The build validates the file
and refuses to assemble a page from a broken one.

---

## The view contract

Every node carries two orthogonal properties, and the build refuses to assemble a file that
gets them wrong.

**`kind`** is who owns it — the thing a reader must not get wrong. The set is declared in
`explorer.config.json`; these are this repository's:

| `kind`   | Meaning                                                        |
| -------- | -------------------------------------------------------------- |
| `person` | A human role                                                   |
| `flex`   | Owned by the FLEX platform                                     |
| `govuk`  | Inside the GOV.UK Once boundary                                |
| `third`  | Outside it — another government organisation, or a third party |

**`plane`** is whether it serves live traffic — `request` or `control`. Ownership is
carried by colour, plane by border style, so the two never compete.

The legend reads _on the request path_ and _off the request path_, deliberately. `control`
is the field name, not a claim that these things are a control plane in the AWS sense: it
also covers source files, naming conventions, runbooks, observability and people. All
thirty-nine boxes on Delivery are `control`, two of them human. Saying "control plane" to a
security audience would mean something narrower than the data supports.

Each kind's colour is a `--p-<id>` token in `styles.css`, beside every other theme token,
because colour is presentation. The rules that use it are generic: the renderer sets
`--kind` on each node, so adding a kind means adding one token in the three theme blocks
and nothing else. The build fails if a kind has no token, if a token is missing from a
theme block, or if a token outlives the kind it was for.

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

### AWS service icons

Most boxes need nothing. A node whose `d.type` is a CloudFormation type —
`AWS::Lambda::Function`, `AWS::WAFv2::WebACL` — picks up the right icon on its own. That
is how the Security tab got all fourteen of its icons without a single edit.

Set `"icon": "lambda"` explicitly only where the type is not a CloudFormation string. The
Containers domain boxes are the case: their type reads `Container group · one Lambda per
route`, which no mapping can resolve, so they name the icon. An explicit `icon` always
wins over the derived one.

The mapping from CloudFormation namespace to icon lives in `SERVICE_ICON` in
`buildArchitectureExplorer.ts`, with `TYPE_ICON` overriding it for full types AWS draws
distinctly — `AWS::EC2::NatGateway` gets the NAT gateway icon rather than the generic VPC
one. It is defined in the build, not the renderer, so the unused-symbol check below sees
exactly what the page sees.

Icons appear in four places, all on the one **AWS icons** control in the header: the
diagram boxes, the Technology line of a node's panel, the Resource line of a resource's
panel, and the rows of the Resources tab. Off by default, remembered per viewer.

Placement is deliberate: the icon rides a box's **top-left corner**, mirroring the count
badge opposite. Riding the corner keeps it clear of the label, so turning icons on never
reflows text and cannot invalidate a box width.

**The icons themselves.** `icons.svg` holds every icon as a `<symbol id="i-<service>">`.
The build inlines it whole, because the page has to stay self-contained: `<use>` cannot
reach a separate file from a `file://` page, and an external reference would not survive
being published as a standalone artifact. A raster sprite is not an option either — the
page pans and zooms, and icons would blur exactly when someone is trying to read them.

The file's header records where the artwork came from: the source URL, the package
filename, and the path of every icon inside it. Each symbol is the icon's own artwork with
the XML declaration, outer `<svg>` and `<title>` dropped, and internal `id` attributes
removed because they collide once every icon shares one document. No geometry is changed.
**Adding to it means accepting AWS's terms for this repository — read them first.**

The build enforces both directions: an `icon` naming a symbol that does not exist fails,
and a symbol nothing uses fails. "Uses" counts explicit `icon` fields _and_ every type
that maps to one, across nodes, zones, edges and resource items — so an icon that only the
Resources tab needs still counts as used.

Two tabs carry no icons on purpose. **Components** describes code — `domain.config.ts`,
the Middy stack, `lookupRoute` — and not one of its boxes is an AWS service. **Context** is
the business view for non-engineers, where a single AWS logo among seven business systems
would read as an accident.

### Light and dark

Both palettes are defined in `styles.css`, and the page follows the reader's system
setting by default. The **theme control** in the header cycles system → light → dark →
system: three states rather than two, because someone who overrides the theme needs a way
back to following the system. The choice is remembered per viewer.

The dark palette is a real design, not an inversion — the kind colours have separate dark
values chosen to hold their contrast on a dark ground. If you add a colour to the palette,
give it both.

### Saving a diagram

**Save PNG** in the header writes the whole diagram at twice its natural size, named for
the view and the selected stage — `flex-containers-prod.png`. It exports everything, not
the current viewport, so pan and zoom do not matter. Icons, count badges, edge labels and
zone labels all come with it. The control hides on the Resources tab, which has no canvas.

Two limits worth knowing. Rasterising through a canvas cannot fetch webfonts, so on a
machine without IBM Plex installed the text falls back to a system face — it should still
fit, because boxes are sized for the widest metrics with slack, but it will not look
identical. And the artifact viewer blocks any download a page starts itself, so the button
is inert there; from Pages, `file://` and a local server it works.

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
- an `icon` with no matching symbol in `icons.svg`, or a symbol nothing uses
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

## Porting this to another project

The build, the renderer, the checks and the export know nothing about FLEX. Four things do:

1. **`explorer.config.json`** — rewrite it. Name, kinds, stages, repo URL.
2. **The `--p-<id>` tokens in `styles.css`** — one colour per kind you declared, in all
   three theme blocks. The build tells you if you miss one.
3. **`views/*.json`** — your content. This is the work, and it is the part that has to be
   checked against code rather than assumed.
4. **`architectureFacts.ts`** — this one cannot be reused. It reads
   `domains/*/domain.config.ts` with FLEX's exact schema, which is the point: counts are
   trustworthy because they come from the same files the CDK app reads. Write your own
   against your own configs, or delete it, leave `from` off every resource, and maintain
   counts by hand — the check skips when nothing declares a source.

`icons.svg` carries only the icons this project uses, because the build fails on a symbol
nothing references. A new project starts from its own subset, not this one.

What you do not touch: `buildArchitectureExplorer.ts` beyond its `SERVICE_ICON` map,
`checkArchitectureExplorer.ts`, `serveArchitectureDocs.ts`, `app.js`, or the rest of
`styles.css`.

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
