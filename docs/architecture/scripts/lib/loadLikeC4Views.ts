/**
 * Reads the LikeC4 model and returns the shape the explorer build already works with.
 *
 * The .c4 files are the source. Nothing is generated to disk in between: a derived JSON
 * would either be committed and drift, or be gitignored and so never reviewed. Reading
 * the model in-process avoids both, and every existing gate keeps working unchanged.
 *
 * What the .c4 cannot hold sits in model/views.json: tab order, audience, the reference
 * tables, and the resource inventory — a LikeC4 `view` has no metadata block, and the
 * inventory is a table rather than a view of the model.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { LikeC4 } from "likec4";

interface Meta {
  name: string;
  order: number;
  group: string;
  audience: string;
  blurb: string;
  note?: string;
  w?: number;
  h?: number;
  type?: string;
  tables?: unknown[];
  /** A doc view names its own data file rather than inlining it. */
  inventory?: string;
}

const num = (v: unknown, fallback = 0) =>
  typeof v === "string" && v.trim() !== "" ? Number(v) : fallback;
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
/** LikeC4 collapses a one-element array literal to a plain string, so widen it back. */
function arr(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v as string[];
  if (typeof v === "string") return [v];
  return undefined;
}

/** metadata carries our data; everything here is optional by construction. */
function detail(
  md: Record<string, unknown>,
  links: { url: string; title?: string }[],
) {
  const d: Record<string, unknown> = {};
  for (const k of ["type", "tech", "role", "protocol", "auth", "carries"])
    if (str(md[k])) d[k] = md[k];
  const facts = arr(md.facts);
  if (facts) d.facts = facts;
  // a link is stored as the repo URL plus the label the explorer shows
  if (links.length)
    d.code = links.map((l) => [
      l.title ?? l.url,
      l.url.replace(/^https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/[^/]+\//, ""),
    ]);
  return d;
}

const srcId = (el: { $element?: { metadata?: Record<string, unknown> } }) =>
  str(el.$element?.metadata?.sourceId);

export async function loadLikeC4Views(modelDir: string) {
  const likec4 = await LikeC4.fromWorkspace(modelDir, { logger: false });
  if (likec4.hasErrors()) {
    likec4.printErrors();
    throw new Error(`${modelDir} has LikeC4 errors`);
  }
  const model = await likec4.computedModel();
  const meta = JSON.parse(
    readFileSync(path.join(modelDir, "views.json"), "utf8"),
  ) as Record<string, Meta>;

  const views = [];
  for (const [id, m] of Object.entries(meta)) {
    if (m.inventory) {
      const { inventory, ...rest } = m;
      const doc = JSON.parse(
        readFileSync(path.join(modelDir, inventory), "utf8"),
      ) as { groups: unknown[] };
      views.push({ id, ...rest, type: "doc", groups: doc.groups });
      continue;
    }
    const prefix = id.replace(/[^a-z0-9]/g, "") + "_";
    const nodes = [];
    const zones = [];
    for (const el of model.elements()) {
      const short = el.id.split(".").pop() ?? el.id;
      if (!short.startsWith(prefix)) continue;
      const md = (el.$element.metadata ?? {}) as Record<string, unknown>;
      const links = (el.$element.links ?? []) as {
        url: string;
        title?: string;
      }[];
      const base = {
        id: str(md.sourceId) ?? short.slice(prefix.length),
        x: num(md.x),
        y: num(md.y),
        w: num(md.w),
        h: num(md.h),
        order: num(md.order, 0),
        d: detail(md, links),
      };
      if (el.kind === "boundary")
        zones.push({ ...base, label: el.title, hard: md.boundary === "hard" });
      else
        nodes.push({
          ...base,
          label: el.title,
          sub: el.description.text ?? "",
          kind: str(md.ownership) ?? "flex",
          plane: el.tags.includes("off-request-path") ? "control" : "request",
          ...(str(md.awsIcon) ? { icon: md.awsIcon } : {}),
        });
    }
    const placement: Record<string, string[]> = {};
    for (const el of model.elements()) {
      const short = el.id.split(".").pop() ?? el.id;
      if (!short.startsWith(prefix)) continue;
      const res = arr((el.$element.metadata ?? {})["resources"]);
      if (res)
        placement[
          str((el.$element.metadata ?? {}).sourceId) ??
            short.slice(prefix.length)
        ] = res;
    }
    const edges = [];
    for (const r of model.relationships()) {
      const from = r.source.id.split(".").pop() ?? "";
      const to = r.target.id.split(".").pop() ?? "";
      if (!from.startsWith(prefix) || !to.startsWith(prefix)) continue;
      const md = (r.$relationship.metadata ?? {}) as Record<string, unknown>;
      const links = (r.$relationship.links ?? []) as {
        url: string;
        title?: string;
      }[];
      edges.push({
        from: srcId(r.source) ?? from.slice(prefix.length),
        to: srcId(r.target) ?? to.slice(prefix.length),
        label: r.title ?? "",
        dir: str(md.edgeDir) ?? null,
        style: str(md.edgeStyle) ?? null,
        order: num(md.order, 0),
        d: detail(md, links),
      });
    }
    const byOrder = (a: { order?: number }, b: { order?: number }) =>
      (a.order ?? 0) - (b.order ?? 0);
    nodes.sort(byOrder);
    zones.sort(byOrder);
    edges.sort(byOrder);
    /** `order` exists only to restore the authored sequence; it is not part of a view. */
    const strip = (o: { order?: number }) => {
      const rest: Record<string, unknown> = { ...o };
      delete rest.order;
      return rest;
    };
    views.push({
      id,
      ...m,
      zones: zones.map(strip),
      nodes: nodes.map(strip),
      edges: edges.map(strip),
      placement,
    });
  }
  return views.sort((a, b) => a.order - b.order);
}
