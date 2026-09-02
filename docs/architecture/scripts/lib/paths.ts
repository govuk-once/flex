/**
 * The three roots this package works against, kept deliberately separate.
 *
 * - `DOCS_ROOT`   — this package: the model, the config, the built page, the facts file.
 * - `SITE_ROOT`   — the folder published to GitHub Pages, which is `docs/`, one level up.
 *                   The landing page lives there, beside guides this package does not own.
 * - `SOURCE_ROOT` — the FLEX checkout being documented.
 *
 * Today the source is the repository this package sits in, so `source.root` in
 * `explorer.config.json` is a relative hop up to it. When these docs move to their own
 * repository they will read a checkout of FLEX pulled in beside them, and only that one
 * field changes — every read of FLEX code already goes through `SOURCE_ROOT` and the globs
 * declared next to it, so nothing else has to move.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const DOCS_ROOT = path.resolve(import.meta.dirname, "../..");
export const SITE_ROOT = path.resolve(DOCS_ROOT, "..");

const CONFIG_PATH = path.join(DOCS_ROOT, "explorer/explorer.config.json");

/** Everything this package reads out of the FLEX source, declared in one place. */
export interface SourceContract {
  /** Where the FLEX checkout is, relative to this package. */
  root: string;
  /** Imported as modules — these are the files the CDK app itself reads. */
  domainConfigs: string;
  gatewayConfigs: string;
  /** Read as text and parsed, so this one needs no install in the checkout. */
  alarmConstructs: string;
}

function readContract(): SourceContract {
  let parsed: { source?: Partial<SourceContract> };
  try {
    parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as typeof parsed;
  } catch (err) {
    throw new Error("explorer.config.json is missing or not valid JSON", {
      cause: err,
    });
  }
  const source = parsed.source;
  const missing = (
    ["root", "domainConfigs", "gatewayConfigs", "alarmConstructs"] as const
  ).filter((k) => typeof source?.[k] !== "string" || !source[k]);
  if (!source || missing.length)
    throw new Error(
      `explorer.config.json: "source" needs ${missing.join(", ")} — this is where the ` +
        `FLEX checkout and the files read from it are declared.`,
    );
  return source as SourceContract;
}

export const SOURCE = readContract();

export const SOURCE_ROOT = path.resolve(DOCS_ROOT, SOURCE.root);

/**
 * A wrong `source.root` otherwise surfaces as an empty facts file or a citation check that
 * fails on every path at once, which reads as the docs being broken rather than pointed at
 * the wrong place. Fail here instead, naming what was expected and where it looked.
 */
export function assertSourceRoot(): void {
  const probe = path.join(SOURCE_ROOT, SOURCE.alarmConstructs);
  if (!existsSync(probe))
    throw new Error(
      `No FLEX source at ${SOURCE_ROOT} — expected to find ${SOURCE.alarmConstructs} ` +
        `there. Set "source.root" in explorer.config.json to the checkout.`,
    );
}

/** Resolve a repo-relative path — a citation, a glob root — inside the FLEX checkout. */
export const inSource = (...rel: string[]) => path.join(SOURCE_ROOT, ...rel);

/** Resolve a path inside this package. */
export const inDocs = (...rel: string[]) => path.join(DOCS_ROOT, ...rel);
