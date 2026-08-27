/**
 * Builds the interactive architecture explorer from its parts.
 *
 *   docs/architecture/explorer/views/*.json   one file per tab (the content)
 *   docs/architecture/explorer/styles.css     presentation
 *   docs/architecture/explorer/shell.html     page markup
 *   docs/architecture/explorer/app.js         renderer and interactions
 *        │
 *        └─> docs/architecture/explorer.html  single self-contained page (committed)
 *
 * The page has to stay single-file: it is served straight from the docs folder and
 * published as a shareable artifact, neither of which can fetch a sibling file.
 *
 * Run:  pnpm architecture:build
 *       pnpm architecture:build --body /tmp/body.html   (same page without the
 *                                                        html/head/body wrapper,
 *                                                        for artifact publishing)
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { check } from "prettier";

import type {
  ArchitectureFacts,
  PerStage,
  StageKey,
} from "./lib/architectureTypes.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "docs/architecture/explorer");
const OUT = path.join(ROOT, "docs/architecture/explorer.html");
const FACTS = path.join(ROOT, "docs/architecture/architecture-facts.json");

/**
 * Resource counts that ARE derivable from the domain and gateway configs, and where each
 * one lives in architecture-facts.json. Without this the generated facts are a document
 * nobody reads, and a route added to a domain silently makes the diagram lie.
 *
 * `pick` is a typed accessor rather than a dotted path, so a change to the facts shape is
 * a compile error here instead of a silently-undefined lookup at build time.
 */
const DERIVED: {
  id: string;
  where: string;
  pick: (f: ArchitectureFacts) => PerStage | undefined;
}[] = [
  ...["dvla", "udp", "uns", "groups", "local-council", "example"].map(
    (name) => ({
      id: `lambda-domain-${name === "local-council" ? "lc" : name}`,
      where: `domains.${name}.perStage`,
      pick: (f: ArchitectureFacts) =>
        f.domains.find((d) => d.name === name)?.perStage,
    }),
  ),
  {
    id: "api-routes-public",
    where: "totals.routeMethods.public",
    pick: (f) => f.totals.routeMethods.public,
  },
  {
    id: "api-routes-private",
    where: "totals.routeMethods.private",
    pick: (f) => f.totals.routeMethods.private,
  },
  {
    id: "api-authorizer",
    where: "totals.domainsWithPublicRoutes",
    pick: (f) => f.totals.domainsWithPublicRoutes,
  },
];

/** The views abbreviate stage names; the facts file spells them out. */
const STAGE_KEY: Record<StageShort, StageKey> = {
  dev: "development",
  stg: "staging",
  prod: "production",
  eph: "ephemeral",
};

const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">';

type Kind = "person" | "flex" | "govuk" | "third";
type Plane = "request" | "control";
type StageShort = "dev" | "stg" | "prod" | "eph";

/** The payload behind every clickable thing: what it is, and the code that proves it. */
interface Detail {
  facts: string[];
  code?: string[][];
  type?: string;
  tech?: string;
  role?: string;
  protocol?: string;
  auth?: string;
  carries?: string;
}

interface Box {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  d: Detail;
}

interface ViewNode extends Box {
  sub: string;
  kind: Kind;
  plane: Plane;
}

interface Zone extends Box {
  hard: boolean;
}

interface Edge {
  from: string;
  to: string;
  label: string;
  dir: string | null;
  style: string | null;
  d: Detail;
}

interface Table {
  name: string;
  cols: string[];
  rows: string[][];
  note?: string;
}

/** A count is either flat, or one number per stage. */
type Count = number | Partial<Record<StageShort, number>> | null;

interface DocItem {
  id: string;
  name: string;
  n: Count;
  meta: string[];
  d: Detail;
}

interface DocGroup {
  name: string;
  note: string | null;
  table: Table | null;
  items: DocItem[];
}

interface View {
  id: string;
  name: string;
  order: number;
  /** Optional in the type because JSON.parse cannot promise them; validated below. */
  group?: string;
  blurb: string;
  audience?: string;
  note: string;
  /** Diagram views only. */
  w?: number;
  h?: number;
  zones?: Zone[];
  nodes?: ViewNode[];
  edges?: Edge[];
  tables?: Table[];
  placement?: Record<string, string[]>;
  /** Reference views only — set to "doc" by loadViews(). */
  type?: string;
  groups?: DocGroup[];
}

function loadViews(): View[] {
  const dir = path.join(SRC, "views");
  const views = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const raw = readFileSync(path.join(dir, f), "utf8");
      try {
        return JSON.parse(raw) as View;
      } catch (err) {
        throw new Error(`views/${f} is not valid JSON`, { cause: err });
      }
    })
    .sort((a, b) => a.order - b.order);

  // A view with groups and no nodes is a reference tab; the renderer keys off this.
  for (const v of views) if (!v.nodes && v.groups) v.type = "doc";

  for (const v of views)
    if (!v.audience?.trim())
      throw new Error(
        `views/${v.id}.json has no "audience" — every tab must say who it is for`,
      );

  for (const v of views)
    if (!v.group?.trim())
      throw new Error(
        `views/${v.id}.json has no "group" — every tab belongs to a section of the tab bar`,
      );
  // Groups must form contiguous runs, or the tab bar draws the same label twice.
  const seen = new Set<string>();
  let run: string | null = null;
  for (const v of views) {
    const g = v.group ?? "";
    if (g === run) continue;
    if (seen.has(g))
      throw new Error(
        `group "${g}" is split across non-adjacent tabs — check the order fields`,
      );
    seen.add(g);
    run = g;
  }

  const ids = views.map((v) => v.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) throw new Error(`duplicate view ids: ${dupes.join(", ")}`);
  return views;
}

/** Catches the class of bug where a literal <name> is eaten as an unknown HTML tag. */
function checkAngleBrackets(views: View[]) {
  const bad: string[] = [];
  const walk = (node: unknown, trail: string) => {
    if (typeof node === "string") {
      const stripped = node.replace(/<\/?(b|code|i)>/g, "");
      if (/[<>]/.test(stripped)) bad.push(`${trail}: ${node.slice(0, 90)}`);
    } else if (Array.isArray(node))
      node.forEach((v, i) => {
        walk(v, `${trail}[${String(i)}]`);
      });
    else if (node && typeof node === "object")
      for (const [k, v] of Object.entries(node)) walk(v, `${trail}.${k}`);
  };
  views.forEach((v) => {
    walk(v, v.id);
  });
  if (bad.length)
    throw new Error(
      `raw angle brackets found — use {stage}, {domain} etc instead:\n  ${bad.join("\n  ")}`,
    );
}

function checkGeometry(views: View[]) {
  const problems: string[] = [];
  for (const v of views) {
    const nodes = v.nodes ?? [];
    const zones = v.zones ?? [];
    for (const n of nodes) {
      if (n.w < 176)
        problems.push(
          `${v.id}/${n.id}: width ${String(n.w)} is below the 176 minimum`,
        );
      if (!["person", "flex", "govuk", "third"].includes(n.kind))
        problems.push(`${v.id}/${n.id}: unknown kind "${n.kind}"`);
      if (!["request", "control"].includes(n.plane))
        problems.push(`${v.id}/${n.id}: unknown plane "${n.plane}"`);
      if (n.sub && n.sub.trim() === n.label.trim())
        problems.push(`${v.id}/${n.id}: sub just repeats the label`);
      // Text starts at x+16 and must clear the right edge by 6.
      // sub is IBM Plex Mono at 10.5px — a fixed 6.3px advance, so this is exact.
      // label is proportional; 6.7 is the measured mean, so it flags only labels that
      // overflow even at average glyph width. The render harness catches the rest.
      const avail = n.w - 22;
      if (n.label && n.label.length * 6.7 > avail)
        problems.push(
          `${v.id}/${n.id}: label "${n.label}" overflows ${String(n.w)}px`,
        );
      if (n.sub && n.sub.length * 6.3 > avail)
        problems.push(
          `${v.id}/${n.id}: sub "${n.sub}" overflows ${String(n.w)}px`,
        );
    }
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      if (!a) continue;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        if (!b) continue;
        if (
          a.x < b.x + b.w &&
          a.x + a.w > b.x &&
          a.y < b.y + b.h &&
          a.y + a.h > b.y
        )
          problems.push(`${v.id}: boxes ${a.id} and ${b.id} overlap`);
      }
    }
    // Zone labels are IBM Plex Mono 11px with .12em tracking — a fixed 7.92px advance.
    for (const z of zones)
      if (z.label && z.label.length * 7.92 > z.w - 22)
        problems.push(
          `${v.id}/${z.id}: zone label "${z.label}" overflows ${String(z.w)}px`,
        );

    for (const n of nodes)
      for (const z of zones) {
        const inside =
          n.x >= z.x &&
          n.x + n.w <= z.x + z.w &&
          n.y >= z.y &&
          n.y + n.h <= z.y + z.h;
        const touches =
          n.x < z.x + z.w &&
          n.x + n.w > z.x &&
          n.y < z.y + z.h &&
          n.y + n.h > z.y;
        if (touches && !inside)
          problems.push(`${v.id}: ${n.id} straddles the edge of zone ${z.id}`);
      }
    const ids = new Set(nodes.map((n) => n.id));
    for (const e of v.edges ?? []) {
      if (!ids.has(e.from))
        problems.push(`${v.id}: edge from unknown node "${e.from}"`);
      if (!ids.has(e.to))
        problems.push(`${v.id}: edge to unknown node "${e.to}"`);
    }
  }
  return problems;
}

/** Every derivable count must equal what the configs actually say. */
function checkDerivedCounts(views: View[]): string[] {
  const problems: string[] = [];
  let facts: ArchitectureFacts;
  try {
    facts = JSON.parse(readFileSync(FACTS, "utf8")) as ArchitectureFacts;
  } catch {
    return ["architecture-facts.json is missing — run pnpm architecture:facts"];
  }

  const resources = views.find((v) => v.id === "resources");
  const items = new Map<string, DocItem>();
  for (const g of resources?.groups ?? [])
    for (const it of g.items) items.set(it.id, it);

  for (const { id, where, pick } of DERIVED) {
    const item = items.get(id);
    if (!item) {
      problems.push(`resources: no item "${id}" to check against ${where}`);
      continue;
    }
    const truth = pick(facts);
    if (!truth) {
      problems.push(`architecture-facts.json has no ${where}`);
      continue;
    }
    for (const short of Object.keys(STAGE_KEY) as StageShort[]) {
      const long = STAGE_KEY[short];
      const claimed = typeof item.n === "number" ? item.n : item.n?.[short];
      if (claimed !== truth[long])
        problems.push(
          `resources/${id}: says ${String(claimed)} for ${short}, but the configs say ` +
            `${String(truth[long])} (${where}.${long}). Update views/resources.json, or fix the config.`,
        );
    }
  }
  return problems;
}

/**
 * The view files are committed JSON, and eslint formats JSON with prettier like anything
 * else. Checking it here means a hand-edited view fails the build immediately, rather than
 * passing locally and failing lint in CI.
 */
async function checkFormatting(): Promise<string[]> {
  const dir = path.join(SRC, "views");
  const problems: string[] = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    const file = path.join(dir, f);
    if (!(await check(readFileSync(file, "utf8"), { filepath: file })))
      problems.push(
        `views/${f}: not prettier-formatted — run pnpm exec eslint --fix ${path.relative(ROOT, file)}`,
      );
  }
  return problems;
}

function checkPlacement(views: View[]) {
  const resources = views.find((v) => v.id === "resources");
  if (!resources) return ["no resources view — placement cannot be checked"];
  const known = new Set<string>();
  for (const g of resources.groups ?? [])
    for (const it of g.items) known.add(it.id);

  const problems: string[] = [];
  const used = new Set<string>();
  for (const v of views)
    for (const [box, ids] of Object.entries(v.placement ?? {}))
      for (const id of ids) {
        used.add(id);
        if (!known.has(id))
          problems.push(`${v.id}/${box}: unknown resource id "${id}"`);
      }
  const orphans = [...known].filter((id) => !used.has(id));
  if (orphans.length)
    problems.push(`resources reachable from no diagram: ${orphans.join(", ")}`);
  return problems;
}

/** The Pages landing page and the local server's landing page are the same file. */
function writeIndex(views: View[]) {
  const docs = path.join(ROOT, "docs");
  const md = (dir: string) =>
    readdirSync(path.join(docs, dir), { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => e.name)
      .sort();
  const list = (dir: string, files: string[]) =>
    files
      .map((f) => `<li><a href="${dir}${f}">${f.replace(/\.md$/, "")}</a></li>`)
      .join("");
  const tabs = views
    .map((v) => `<li><b>${v.name}</b><span>${v.audience ?? ""}</span></li>`)
    .join("");
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>FLEX documentation</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
:root{--bg:#f4f6f8;--surface:#fff;--ink:#0f1720;--ink-2:#3d4b5a;--muted:#66768a;--line:#dbe1e8;--accent:#12539f;--accent-soft:#e3ecf8}
@media (prefers-color-scheme:dark){:root{--bg:#0b1119;--surface:#121b26;--ink:#e8eef5;--ink-2:#b9c6d4;--muted:#8394a6;--line:#25333f;--accent:#63a4f5;--accent-soft:#152a44}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);line-height:1.55;
 font-family:"IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
main{max-width:880px;margin:0 auto;padding:56px 28px 96px}
h1{font-size:28px;letter-spacing:-.02em;margin:0 0 6px}
.sub{color:var(--muted);margin:0 0 32px;font-size:14px}
.hero{display:block;padding:22px 24px;border:1px solid var(--accent);border-radius:10px;background:var(--accent-soft);
 text-decoration:none;color:inherit;margin-bottom:14px}
.hero b{display:block;font-size:18px;color:var(--accent);margin-bottom:5px}
.hero span{color:var(--ink-2);font-size:14px}
.tabs{list-style:none;margin:0 0 34px;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:2px 18px}
.tabs li{display:flex;flex-direction:column;padding:7px 0;font-size:13px;border-top:1px solid var(--line)}
.tabs b{color:var(--ink)}.tabs span{color:var(--muted);font-size:12px}
h2{font:600 11px/1 "IBM Plex Mono",monospace;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);
 margin:30px 0 10px;padding-bottom:9px;border-bottom:1px solid var(--line)}
ul.docs{list-style:none;margin:0;padding:0;display:grid;gap:2px}
ul.docs a{display:block;padding:8px 12px;border-radius:6px;color:var(--ink-2);text-decoration:none;font-size:14px}
ul.docs a:hover{background:var(--surface);color:var(--accent)}
code{font-family:"IBM Plex Mono",monospace;font-size:12.5px}
</style></head><body><main>
<h1>FLEX documentation</h1>
<p class="sub">Generated from the repository. Rebuild with <code>pnpm architecture:build</code>.</p>
<a class="hero" href="architecture/explorer.html"><b>Architecture Explorer &rarr;</b>
<span>Eight tabs. Pan, zoom, and click any box or line for the protocol, the auth and what travels over it.</span></a>
<ul class="tabs">${tabs}</ul>
<h2>Guides</h2><ul class="docs">${list("", md("."))}</ul>
<h2>Runbooks</h2><ul class="docs">${list("runbooks/", md("runbooks"))}</ul>
</main></body></html>`;
  writeFileSync(path.join(docs, "index.html"), page);
  console.log("Wrote docs/index.html (landing page)");
}

async function main() {
  const bodyFlag = process.argv.indexOf("--body");
  const views = loadViews();

  checkAngleBrackets(views);
  const problems = [
    ...(await checkFormatting()),
    ...checkGeometry(views),
    ...checkPlacement(views),
    ...checkDerivedCounts(views),
  ];
  const strict = !process.argv.includes("--lenient");
  if (problems.length) {
    console.error(`\n${String(problems.length)} problem(s):`);
    problems.forEach((p) => {
      console.error(`  - ${p}`);
    });
    if (strict) process.exit(1);
  }

  const placement = Object.fromEntries(
    views.map((v) => [v.id, v.placement ?? {}]),
  );
  const data =
    `/* Generated by scripts/buildArchitectureExplorer.ts — edit explorer/views/*.json instead. */\n` +
    `const VIEWS=${JSON.stringify(views)};\n` +
    `const PLACEMENT=${JSON.stringify(placement)};\n`;

  const body = [
    "<title>FLEX Architecture Explorer</title>",
    FONTS,
    `<style>\n${readFileSync(path.join(SRC, "styles.css"), "utf8")}</style>`,
    readFileSync(path.join(SRC, "shell.html"), "utf8"),
    `<script>\n${data}\n${readFileSync(path.join(SRC, "app.js"), "utf8")}\n</script>`,
  ].join("\n");

  if (bodyFlag !== -1) {
    const dest = process.argv[bodyFlag + 1];
    if (!dest) throw new Error("--body needs a destination path");
    writeFileSync(dest, body);
    console.log(`Wrote ${dest} (artifact body, no wrapper)`);
  }

  const page = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n${body.split("\n").slice(0, 4).join("\n")}\n</head>\n<body>\n${body.split("\n").slice(4).join("\n")}\n</body>\n</html>\n`;
  writeFileSync(OUT, page);
  console.log(
    `Wrote ${path.relative(ROOT, OUT)} (${(page.length / 1024).toFixed(0)} KB, ${String(views.length)} tabs)`,
  );
  writeIndex(views);
}

await main();
