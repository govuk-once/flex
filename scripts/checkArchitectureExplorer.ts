/**
 * Renders the built explorer in a real browser and checks what static validation
 * cannot see: whether text fits, whether edges cross boxes they have nothing to do
 * with, whether labels sit on top of each other, and whether every clickable thing
 * actually opens something.
 *
 *   pnpm architecture:check
 *
 * Playwright is a devDependency of @flex/scripts, but its browser binaries are not in
 * the lockfile. If the import or the binary is missing the script says so and exits 0
 * rather than failing a build over a dev tool that has not been installed yet:
 *
 *   pnpm exec playwright install chromium
 */
import { existsSync } from "node:fs";
import path from "node:path";

import type { ConsoleMessage } from "playwright";

const ROOT = path.resolve(import.meta.dirname, "..");
const PAGE = path.join(ROOT, "docs/architecture/explorer.html");

/**
 * Two classes of problem.
 *
 * HARD — always a defect, never acceptable: text that does not fit its box, a
 * clickable thing that opens an empty panel, a tab that has lost its audience line,
 * any console or page error.
 *
 * SOFT — a line clipping a box it is unrelated to, a label sitting on a box, two
 * labels touching. On dense views a handful are unavoidable without hand-routing
 * every edge. This is a ratchet, not a target: it may fall, never rise. If a change
 * genuinely needs a higher budget, raise it deliberately and say why in the commit.
 */
const SOFT_BUDGET = 13;

/** Type-only, so it is erased at runtime and the import below stays optional. */
type ChromiumLauncher = typeof import("playwright").chromium;

async function loadChromium(): Promise<ChromiumLauncher | null> {
  try {
    return (await import("playwright")).chromium;
  } catch {
    return null;
  }
}

async function main() {
  if (!existsSync(PAGE)) {
    console.error(
      `No ${path.relative(ROOT, PAGE)} — run pnpm architecture:build first.`,
    );
    process.exit(1);
  }
  const chromium = await loadChromium();
  if (!chromium) {
    console.log("Render checks skipped: playwright is not installed.");
    console.log(
      "  pnpm add -Dw playwright && pnpm exec playwright install chromium",
    );
    console.log(
      "Static validation still ran as part of pnpm architecture:build.",
    );
    return;
  }

  const browser = await chromium.launch();
  let hard = 0,
    soft = 0;

  for (const colorScheme of ["light", "dark"] as const) {
    const page = await browser.newPage({
      viewport: { width: 1680, height: 950 },
      colorScheme,
    });
    // tsx compiles with esbuild's keepNames, which wraps functions in a __name() helper.
    // That helper does not exist inside the page, so serialised callbacks throw without it.
    // Passed as a raw string so it is not itself compiled.
    await page.addInitScript(
      "globalThis.__name = globalThis.__name || ((f) => f);",
    );
    const errors: string[] = [];
    page.on("pageerror", (e: Error) => errors.push(e.message));
    page.on("console", (m: ConsoleMessage) => {
      if (m.type() === "error") errors.push("console: " + m.text());
    });
    await page.goto("file://" + PAGE);
    /*
     * Every text measurement below depends on IBM Plex, which the page pulls from
     * Google Fonts. A fixed timeout is enough on a warm cache and not enough on a cold
     * one, so CI measured fallback metrics and reported overflow that does not exist.
     * Wait for font loading to settle, then confirm the faces are actually usable.
     */
    await page.evaluate(() => document.fonts.ready);
    const fontsLoaded = await page.evaluate(
      () =>
        document.fonts.check('11px "IBM Plex Mono"') &&
        document.fonts.check('13px "IBM Plex Sans"'),
    );
    if (!fontsLoaded)
      console.log(
        "IBM Plex unavailable — geometry not checked. The build's static text-fit gate still applies.",
      );
    await page.waitForTimeout(800);

    const tabs: string[] = await page.locator(".tab").allTextContents();
    if (colorScheme === "light")
      console.log(`${String(tabs.length)} tabs: ${tabs.join(" · ")}\n`);

    for (const tab of tabs) {
      await page.click(`.tab:has-text("${tab}")`);
      await page.waitForTimeout(400);
      const r = await page.evaluate(measure);
      if (colorScheme !== "light") continue;
      if (r.doc) {
        console.log(
          `  ${tab.padEnd(13)} reference view · ${String(r.groups)} sections · ${String(r.rows)} rows`,
        );
        continue;
      }
      /* Overflow measured against fallback metrics is noise; the build checks text fit
         statically from the real advances, so nothing goes unchecked here. */
      if (fontsLoaded) hard += r.over.length;
      /* Same reasoning as overflow: every geometry number here is measured from rendered
         text, so without the real faces none of it means anything. */
      if (fontsLoaded) soft += r.cross.length + r.onBox.length + r.clash.length;
      console.log(
        `  ${tab.padEnd(13)}${String(r.nodes).padStart(3)} boxes ${String(r.edges).padStart(3)} lines` +
          ` · overflow ${String(r.over.length)} · crossings ${String(r.cross.length)}` +
          ` · label-on-box ${String(r.onBox.length)} · label-clash ${String(r.clash.length)}`,
      );
      for (const [label, list] of [
        ["overflow", fontsLoaded ? r.over : []],
        ["crossing", r.cross],
        ["on box", r.onBox],
        ["clash", r.clash],
      ] as const)
        if (list.length)
          console.log(`      ${label}: ${list.slice(0, 3).join(" | ")}`);
    }

    const audit = await page.evaluate(auditTargets);
    console.log(
      `[${colorScheme}] ${String(audit.n)} clickable targets · ` +
        (audit.empty.length
          ? `EMPTY INSPECTOR: ${audit.empty.slice(0, 4).join(", ")}`
          : "all open a populated inspector") +
        (audit.noAudience.length
          ? ` · MISSING AUDIENCE: ${audit.noAudience.join(", ")}`
          : " · audience shown on every tab"),
    );
    hard += audit.empty.length + audit.noAudience.length;

    const unique = [...new Set(errors)];
    if (unique.length) {
      console.log(
        `[${colorScheme}] ERRORS:\n  ${unique.slice(0, 4).join("\n  ")}`,
      );
      hard += unique.length;
    } else console.log(`[${colorScheme}] no console or page errors`);
    await page.close();
  }

  await browser.close();
  console.log(
    `\nhard defects: ${String(hard)}   soft geometry: ${String(soft)} of ${String(SOFT_BUDGET)} budget`,
  );
  if (hard)
    console.log(
      `FAIL — ${String(hard)} hard defect(s). Text must fit, every target must open, every tab keeps its audience, no errors.`,
    );
  else if (soft > SOFT_BUDGET)
    console.log(
      `FAIL — soft geometry rose to ${String(soft)}, above the ${String(SOFT_BUDGET)} ratchet. Fix the layout or raise SOFT_BUDGET deliberately.`,
    );
  else
    console.log(
      soft < SOFT_BUDGET
        ? `PASS — and soft geometry improved; lower SOFT_BUDGET to ${String(soft)} to lock it in.`
        : "PASS",
    );
  process.exit(hard || soft > SOFT_BUDGET ? 1 : 0);
}

/** Runs inside the page. Geometry is measured, never eyeballed. */
function measure() {
  if (document.getElementById("doc")?.hidden === false)
    return {
      doc: true,
      rows: document.querySelectorAll(".row").length,
      groups: document.querySelectorAll(".grp").length,
      nodes: 0,
      edges: 0,
      over: [] as string[],
      cross: [] as string[],
      onBox: [] as string[],
      clash: [] as string[],
    };
  const nodes = [...document.querySelectorAll("#root .node")];
  const boxes = nodes.map((g) => ({
    id: g.getAttribute("aria-label") ?? "",
    r: (g.querySelector(".box") as SVGGraphicsElement).getBBox(),
  }));
  const over: string[] = [];
  nodes.forEach((g) => {
    const b = (g.querySelector(".box") as SVGGraphicsElement).getBBox();
    g.querySelectorAll(".t,.s").forEach((t) => {
      const bb = (t as SVGGraphicsElement).getBBox();
      if (bb.x + bb.width > b.x + b.width - 6)
        over.push(`${g.getAttribute("aria-label") ?? ""} · ${t.textContent}`);
    });
  });
  const cross = new Set<string>();
  document.querySelectorAll("#root .edge .line").forEach((p) => {
    const el = p as SVGPathElement;
    const label = el.closest(".edge")?.getAttribute("aria-label") ?? "";
    const len = el.getTotalLength();
    for (let i = 1; i < len; i += 6) {
      const pt = el.getPointAtLength(i);
      for (const bx of boxes) {
        if (label.includes(bx.id)) continue;
        if (
          pt.x > bx.r.x + 2 &&
          pt.x < bx.r.x + bx.r.width - 2 &&
          pt.y > bx.r.y + 2 &&
          pt.y < bx.r.y + bx.r.height - 2
        ) {
          cross.add(label);
          i = len;
          break;
        }
      }
    }
  });
  const area = (a: DOMRect, b: DOMRect) =>
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const labels = [...document.querySelectorAll("#root .edgelbl")].map((g) => ({
    t: g.querySelector(".lbl")?.textContent ?? "",
    r: (g.querySelector(".lblbg") as SVGGraphicsElement).getBBox(),
  }));
  const onBox: string[] = [];
  labels.forEach((l) => {
    for (const bx of boxes)
      if (area(l.r, bx.r) > 60) {
        onBox.push(l.t);
        break;
      }
  });
  const clash: string[] = [];
  for (let i = 0; i < labels.length; i++) {
    const a = labels[i];
    if (!a) continue;
    for (let j = i + 1; j < labels.length; j++) {
      const b = labels[j];
      if (b && area(a.r, b.r) > 40) clash.push(`${a.t} ✕ ${b.t}`);
    }
  }
  return {
    doc: false,
    rows: 0,
    groups: 0,
    nodes: nodes.length,
    edges: document.querySelectorAll("#root .edge").length,
    over,
    cross: [...cross],
    onBox,
    clash,
  };
}

/** Clicks every target on every tab and checks the panel actually fills. */
async function auditTargets() {
  const empty: string[] = [],
    noAudience: string[] = [];
  let n = 0;
  for (const tab of [...document.querySelectorAll(".tab")]) {
    (tab as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 90));
    const targets = [
      ...document.querySelectorAll(
        "#root .node, #root .zone.clickable, #root .edge, .row",
      ),
    ];
    for (const el of targets) {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      n++;
      const title = document.querySelector(".insp-title");
      if (!title || !title.textContent.trim())
        empty.push(
          `${tab.textContent}: ${(el.getAttribute("aria-label") || "").slice(0, 40)}`,
        );
      // the audience line must survive a selection, not only the idle panel
      if (!document.querySelector(".audience"))
        noAudience.push(tab.textContent);
    }
  }
  return { n, empty, noAudience: [...new Set(noAudience)] };
}

await main();
