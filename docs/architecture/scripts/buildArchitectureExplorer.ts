/**
 * Builds the interactive architecture explorer from its parts.
 *
 *   docs/architecture/explorer/model/*.c4      the diagrams, as a LikeC4 model
 *   docs/architecture/explorer/model/views.json tab order, audience, tables
 *   docs/architecture/explorer/model/resources.json  the AWS inventory
 *   docs/architecture/explorer/styles.css     presentation
 *   docs/architecture/explorer/shell.html     page markup
 *   docs/architecture/explorer/app.js         renderer and interactions
 *   docs/architecture/explorer/icons.svg      optional AWS icon symbols
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
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { check } from "prettier";

import type { ArchitectureFacts, PerStage } from "./lib/architectureTypes.js";
import { loadLikeC4Views } from "./lib/loadLikeC4Views.js";
import {
  DOCS_ROOT,
  inDocs,
  inSource,
  SITE_ROOT,
  type SourceContract,
} from "./lib/paths.js";

const SRC = inDocs("explorer");
const OUT = inDocs("explorer.html");
const FACTS = inDocs("architecture-facts.json");
const ICONS = path.join(SRC, "icons.svg");
const CONFIG = path.join(SRC, "explorer.config.json");
const MODEL = path.join(SRC, "model");

/**
 * CloudFormation namespace to icon, so every `AWS::X::Y` in a `type` field picks up the
 * right service icon without anything being tagged by hand. Defined here rather than in
 * the renderer so the unused-symbol check below sees the same mapping the page does.
 *
 * A few full types override the namespace where AWS draws the thing distinctly.
 */
const SERVICE_ICON: Record<string, string> = {
  Lambda: "lambda",
  ApiGateway: "apigateway",
  CloudFront: "cloudfront",
  S3: "s3",
  DynamoDB: "dynamodb",
  Cognito: "cognito",
  EC2: "vpc",
  Route53: "route53",
  CloudWatch: "cloudwatch",
  Logs: "cloudwatch",
  SSM: "ssm",
  Chatbot: "chatbot",
  IAM: "iam",
  KMS: "kms",
  // A service-name-to-icon mapping, not a credential; the keyword scanner cannot tell.
  SecretsManager: "secretsmanager", // pragma: allowlist secret
  Shield: "shield",
  WAFv2: "waf",
  CertificateManager: "acm",
  Macie: "macie",
  SNS: "sns",
  Events: "eventbridge",
};
const TYPE_ICON: Record<string, string> = {
  "AWS::CloudFront::Function": "cloudfront-functions",
  "AWS::EC2::NatGateway": "vpc-nat",
  "AWS::EC2::InternetGateway": "vpc-igw",
  "AWS::EC2::VPCEndpoint": "vpc-endpoint",
  "AWS::EC2::FlowLog": "vpc-flowlogs",
};

/** The icon a `type` string implies, if any. */
function iconForType(type: string | undefined): string | undefined {
  if (!type) return undefined;
  const exact = TYPE_ICON[type];
  if (exact) return exact;
  const ns = /^AWS::([A-Za-z0-9]+)::/.exec(type)?.[1];
  return ns ? SERVICE_ICON[ns] : undefined;
}

/**
 * One optional file holds every AWS service icon as a <symbol>. It is inlined whole, so
 * the page stays self-contained: an external sprite cannot be reached by <use> from a
 * file:// page, and would not survive being published as a standalone artifact.
 *
 * The file is absent until someone with authority over third-party artwork puts AWS's
 * icons in it. Until then nodes may still declare `icon`, the symbols simply do not
 * exist, and the toggle stays hidden.
 */
function loadIcons(): { markup: string; ids: Set<string> } {
  if (!existsSync(ICONS)) return { markup: "", ids: new Set() };
  const raw = readFileSync(ICONS, "utf8");
  const ids = new Set<string>();
  for (const m of raw.matchAll(/<symbol[^>]*\sid="i-([a-z0-9-]+)"/g))
    if (m[1]) ids.add(m[1]);
  return { markup: raw, ids };
}

/**
 * Everything about this page that belongs to one project: what it is called, the
 * ownership kinds and their colours, the deployment stages, and which resource counts
 * come from the generated facts. Ported to another repository, this file and the views
 * are what change — the build, the renderer and the checks do not.
 */
interface ExplorerConfig {
  title: string;
  tagline: string;
  docsTitle: string;
  repo: string;
  slug: string;
  inventoryView: string;
  iconLabel: string;
  filterHint: string;
  kinds: { id: string; label: string; colour: string }[];
  stages: { id: string; label: string; facts: string }[];
  /** Where the FLEX checkout is and what is read from it — see lib/paths.ts. */
  source: SourceContract;
}

function loadConfig(): ExplorerConfig {
  let cfg: ExplorerConfig;
  try {
    cfg = JSON.parse(readFileSync(CONFIG, "utf8")) as ExplorerConfig;
  } catch (err) {
    throw new Error("explorer.config.json is missing or not valid JSON", {
      cause: err,
    });
  }
  const blank = (
    [
      "title",
      "tagline",
      "docsTitle",
      "repo",
      "slug",
      "inventoryView",
      "iconLabel",
      "filterHint",
    ] as const
  ).filter((k) => !cfg[k].trim());
  if (blank.length)
    throw new Error(`explorer.config.json has no ${blank.join(", ")}`);
  // paths.ts reads `source` before this runs and fails loudly if it is malformed, so this
  // only guards against it being dropped from the type's point of view.
  if (!cfg.source.root)
    throw new Error("explorer.config.json has no source.root");
  if (!cfg.kinds.length) throw new Error("explorer.config.json has no kinds");
  if (!cfg.stages.length) throw new Error("explorer.config.json has no stages");
  if (!/^[a-z][a-z0-9-]*$/.test(cfg.slug))
    throw new Error(
      "slug must be lowercase kebab-case — it names exported files",
    );
  for (const k of cfg.kinds)
    if (!/^[a-z][a-z0-9-]*$/.test(k.id))
      throw new Error(`kind id "${k.id}" must be lowercase kebab-case`);
  for (const k of cfg.kinds)
    if (!k.colour.trim())
      throw new Error(`kind "${k.id}" names no colour from the palette`);
  return cfg;
}

/**
 * Colour is presentation, so the kind palette lives in styles.css with every other theme
 * token rather than in the config. What the config owns is which kinds exist — which
 * means the two can fall out of step, and a kind with no colour would draw a box with no
 * stroke and say nothing. So the build checks instead of generating: every configured
 * kind needs a `--p-<id>` token in all three theme blocks, and no token may be
 * left behind after its kind is gone. The rules that use them are generic — the
 * renderer passes the colour down as `--kind`, so adding a kind is one token.
 */
function checkKindStyles(kinds: ExplorerConfig["kinds"]): string[] {
  const css = readFileSync(path.join(SRC, "styles.css"), "utf8");
  const problems: string[] = [];
  const palette = new Set(
    [...css.matchAll(/--legend-([a-z0-9-]+):/g)].map((m) => m[1] ?? ""),
  );
  for (const k of kinds) {
    if (!palette.has(k.colour)) {
      problems.push(
        `styles.css: kind "${k.id}" wants --legend-${k.colour}, which the palette does not define`,
      );
      continue;
    }
    const defined = (css.match(new RegExp(`--legend-${k.colour}:`, "g")) ?? [])
      .length;
    if (defined < 3)
      problems.push(
        `styles.css: --legend-${k.colour} is defined in ${String(defined)} of the 3 theme blocks — light, dark media, dark attribute`,
      );
  }
  // Two kinds sharing a colour makes the legend unreadable.
  const used = new Map<string, string>();
  for (const k of kinds) {
    const first = used.get(k.colour);
    if (first)
      problems.push(
        `explorer.config.json: kinds "${first}" and "${k.id}" both use --legend-${k.colour}`,
      );
    else used.set(k.colour, k.id);
  }
  return problems;
}

/** Walks a dotted path from explorer.config.json into the generated facts. */
function resolvePath(
  facts: ArchitectureFacts,
  dotted: string,
): PerStage | undefined {
  let node: unknown = facts;
  for (const key of dotted.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = Array.isArray(node)
      ? node.find((d) => (d as { name?: string }).name === key)
      : (node as Record<string, unknown>)[key];
  }
  return node as PerStage | undefined;
}

const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">';

type Kind = "person" | "flex" | "govuk" | "third";
type Plane = "request" | "control";

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
  /** AWS service icon, without the "i-" prefix. Optional. */
  icon?: string;
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
  /** Where in the repo the table was read from, shown under it as links. */
  code?: [string, string][];
  /**
   * Binds one column to a derived fact array, so a row that no longer matches the
   * code fails the build instead of quietly going stale.
   */
  derived?: { from: string; key: string; col: string };
}

/** A count is either flat, or one number per stage. */
type Count = number | Partial<Record<string, number>> | null;

interface DocItem {
  id: string;
  name: string;
  n: Count;
  /** Dotted path into architecture-facts.json — the count above must match it. */
  from?: string;
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

/**
 * The LikeC4 model is the source. Nothing is generated to disk between it and the page: a
 * derived JSON would either be committed and drift, or gitignored and so never reviewed.
 */
async function loadViews(): Promise<View[]> {
  const views = (await loadLikeC4Views(MODEL)) as unknown as View[];

  // A view with groups and no nodes is a reference tab; the renderer keys off this.
  for (const v of views) if (!v.nodes && v.groups) v.type = "doc";
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

function checkGeometry(views: View[], kindIds: Set<string>) {
  const problems: string[] = [];
  for (const v of views) {
    const nodes = v.nodes ?? [];
    const zones = v.zones ?? [];
    for (const n of nodes) {
      if (n.w < 176)
        problems.push(
          `${v.id}/${n.id}: width ${String(n.w)} is below the 176 minimum`,
        );
      if (!kindIds.has(n.kind))
        problems.push(`${v.id}/${n.id}: unknown kind "${n.kind}"`);
      if (!["request", "control"].includes(n.plane))
        problems.push(`${v.id}/${n.id}: unknown plane "${n.plane}"`);
      if (n.sub && n.sub.trim() === n.label.trim())
        problems.push(`${v.id}/${n.id}: sub just repeats the label`);
      // Text starts at x+16 and must clear the right edge by 6.
      // Calibrated against Chromium on Linux, which renders IBM Plex ~6% wider than
      // macOS does (mono 7.0 vs 6.6px per em-width, sans 11.0 vs 10.56). Designing to
      // the narrower platform lets labels overflow for everyone else, so these are the
      // wider numbers: sub is IBM Plex Mono at 10.5px, a fixed 6.7px advance.
      // label is proportional; 7.0 is the measured mean, so it flags only labels that
      // overflow even at average glyph width. The render harness catches the rest.
      const avail = n.w - 22;
      if (n.label && n.label.length * 7.0 > avail)
        problems.push(
          `${v.id}/${n.id}: label "${n.label}" overflows ${String(n.w)}px`,
        );
      if (n.sub && n.sub.length * 6.7 > avail)
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
    // Zone labels are IBM Plex Mono 11px with .12em tracking: 7.0 + 1.32 on Linux.
    for (const z of zones)
      if (z.label && z.label.length * 8.32 > z.w - 22)
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
function checkDerivedCounts(views: View[], cfg: ExplorerConfig): string[] {
  const problems: string[] = [];
  const resources = views.find((v) => v.id === "resources");
  // A resource says where its own count comes from, so a renamed or deleted row takes
  // its mapping with it rather than leaving a dangling key somewhere else.
  const claims = (resources?.groups ?? [])
    .flatMap((g) => g.items)
    .filter((it) => it.from);
  if (!claims.length) return problems;

  let facts: ArchitectureFacts;
  try {
    facts = JSON.parse(readFileSync(FACTS, "utf8")) as ArchitectureFacts;
  } catch {
    return ["architecture-facts.json is missing — run pnpm architecture:facts"];
  }

  for (const item of claims) {
    const id = item.id;
    const where = item.from ?? "";
    const truth = resolvePath(facts, where);
    if (!truth) {
      problems.push(`architecture-facts.json has no ${where}`);
      continue;
    }
    for (const st of cfg.stages) {
      const claimed = typeof item.n === "number" ? item.n : item.n?.[st.id];
      const actual = truth[st.facts as keyof PerStage];
      if (claimed !== actual)
        problems.push(
          `resources/${id}: says ${String(claimed)} for ${st.id}, but the configs say ` +
            `${String(actual)} (${where}.${st.facts}). Update model/resources.json, or fix the config.`,
        );
    }
  }
  return problems;
}

/**
 * A reference table cites the files it was transcribed from. Those citations are the only
 * thing tying a hand-written table back to the code, so a moved or deleted file has to fail
 * here — a dead link is worse than no link, because it still looks like provenance.
 */
function checkTableCitations(views: View[]): string[] {
  const problems: string[] = [];
  for (const v of views)
    for (const t of v.tables ?? []) {
      if (!t.code?.length) {
        problems.push(`${v.id}/"${t.name}": no code citation`);
        continue;
      }
      for (const [label, rel] of t.code)
        if (!existsSync(inSource(rel)))
          problems.push(
            `${v.id}/"${t.name}": cites ${rel} (${label}), which does not exist`,
          );
    }
  return problems;
}

/**
 * A table can bind one of its columns to a derived fact array. The build then holds the
 * table to the code: an alarm added, removed or renamed in the CDK constructs breaks the
 * build here rather than leaving a table that reads as current and is not.
 */
function checkDerivedTables(views: View[]): string[] {
  const problems: string[] = [];
  const bound = views.flatMap((v) =>
    (v.tables ?? []).flatMap((t) =>
      t.derived ? [{ v, t, d: t.derived }] : [],
    ),
  );
  if (!bound.length) return problems;

  let facts: ArchitectureFacts;
  try {
    facts = JSON.parse(readFileSync(FACTS, "utf8")) as ArchitectureFacts;
  } catch {
    return ["architecture-facts.json is missing — run pnpm architecture:facts"];
  }

  for (const { v, t, d } of bound) {
    const { from, key, col } = d;
    const truth = (facts as unknown as Record<string, unknown>)[from];
    if (!Array.isArray(truth)) {
      problems.push(
        `${v.id}/"${t.name}": architecture-facts.json has no ${from}`,
      );
      continue;
    }
    const at = t.cols.indexOf(col);
    if (at < 0) {
      problems.push(
        `${v.id}/"${t.name}": no "${col}" column to bind to ${from}`,
      );
      continue;
    }
    const strip = (x: string) => x.replace(/<[^>]+>/g, "").trim();
    const claimed = t.rows.map((r) => strip(r[at] ?? ""));
    const actual = (truth as Record<string, unknown>[]).map((x) =>
      String(x[key]),
    );
    const missing = actual.filter((x) => !claimed.includes(x));
    const extra = claimed.filter((x) => !actual.includes(x));
    if (missing.length)
      problems.push(
        `${v.id}/"${t.name}": the code has ${from} not in the table: ${missing.join(", ")}`,
      );
    if (extra.length)
      problems.push(
        `${v.id}/"${t.name}": the table lists ${from} not in the code: ${extra.join(", ")}`,
      );
    if (claimed.length !== actual.length)
      problems.push(
        `${v.id}/"${t.name}": ${String(claimed.length)} rows but the code has ` +
          `${String(actual.length)} ${from}. Run pnpm architecture:facts, then update the table.`,
      );
  }
  return problems;
}

/**
 * The view files are committed JSON, and eslint formats JSON with prettier like anything
 * else. Checking it here means a hand-edited view fails the build immediately, rather than
 * passing locally and failing lint in CI.
 */
async function checkFormatting(): Promise<string[]> {
  const problems: string[] = [];
  // The .c4 files are checked by LikeC4 itself; these are the committed JSON beside them.
  for (const f of readdirSync(MODEL).filter((n) => n.endsWith(".json"))) {
    const file = path.join(MODEL, f);
    if (!(await check(readFileSync(file, "utf8"), { filepath: file })))
      problems.push(
        `model/${f}: not prettier-formatted — run pnpm exec eslint --fix ${path.relative(DOCS_ROOT, file)}`,
      );
  }
  return problems;
}

/** A node may name an icon; it must exist, and every icon must be used. */
function checkIcons(views: View[], ids: Set<string>): string[] {
  const problems: string[] = [];
  const used = new Set<string>();
  for (const v of views) {
    for (const n of v.nodes ?? []) {
      if (!n.icon) continue;
      used.add(n.icon);
      if (ids.size && !ids.has(n.icon))
        problems.push(
          `${v.id}/${n.id}: icon "${n.icon}" has no <symbol id="i-${n.icon}"> in icons.svg`,
        );
    }
    // Anything with a CloudFormation type picks up an icon in the inspector.
    const typed = [
      ...(v.nodes ?? []),
      ...(v.zones ?? []),
      ...(v.edges ?? []),
      ...(v.groups ?? []).flatMap((g) => g.items),
    ];
    for (const o of typed) {
      const ic = iconForType(o.d.type);
      if (ic) used.add(ic);
    }
  }
  for (const id of ids)
    if (!used.has(id))
      problems.push(`icons.svg: <symbol id="i-${id}"> is not used by any node`);
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
  const docs = SITE_ROOT;
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
  console.log(
    `Wrote ${path.relative(SITE_ROOT, path.join(docs, "index.html"))} (landing page, in the published site root)`,
  );
}

async function main() {
  const bodyFlag = process.argv.indexOf("--body");
  const views = await loadViews();
  const cfg = loadConfig();
  const kindIds = new Set(cfg.kinds.map((k) => k.id));

  checkAngleBrackets(views);
  const icons = loadIcons();
  const problems = [
    ...(await checkFormatting()),
    ...checkIcons(views, icons.ids),
    ...(views.some((v) => v.id === cfg.inventoryView)
      ? []
      : [
          `explorer.config.json: inventoryView "${cfg.inventoryView}" is not one of the views`,
        ]),
    ...checkKindStyles(cfg.kinds),
    ...checkGeometry(views, kindIds),
    ...checkPlacement(views),
    ...checkDerivedCounts(views, cfg),
    ...checkTableCitations(views),
    ...checkDerivedTables(views),
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
  const { source: _source, ...pageConfig } = cfg;
  const data =
    `/* Generated by @flex/architecture-docs — edit explorer/model/*.c4 instead. */\n` +
    `const VIEWS=${JSON.stringify(views)};\n` +
    `const PLACEMENT=${JSON.stringify(placement)};\n` +
    // `source` says where the FLEX checkout is. That is a build concern, and the page
    // is published, so it is dropped rather than shipped as a filesystem path.
    `const CONFIG=${JSON.stringify(pageConfig)};\n` +
    `const ICON_IDS=${JSON.stringify([...icons.ids])};\n` +
    `const SERVICE_ICON=${JSON.stringify(SERVICE_ICON)};\n` +
    `const TYPE_ICON=${JSON.stringify(TYPE_ICON)};\n`;

  const body = [
    `<title>${cfg.title}</title>`,
    FONTS,
    `<style>\n${readFileSync(path.join(SRC, "styles.css"), "utf8")}</style>`,
    icons.markup,
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
    `Wrote ${path.relative(DOCS_ROOT, OUT)} (${(page.length / 1024).toFixed(0)} KB, ${String(views.length)} tabs)`,
  );
  writeIndex(views);
}

await main();
