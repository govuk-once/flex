/**
 * Serves docs/ over HTTP so the architecture explorer can be read locally instead of
 * from a hosted link. No dependencies — Node's http and fs only.
 *
 *   pnpm architecture:serve          builds first, then serves on http://localhost:4321
 *   pnpm architecture:serve -- 8080  a different port
 */
import { readFile, stat } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import path from "node:path";

import { SITE_ROOT } from "./lib/paths.js";

const DOCS = SITE_ROOT;
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4321);

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/") url.pathname = "/index.html";
    // Resolve inside docs/ only — a request must not escape the served root.
    const target = path.join(DOCS, decodeURIComponent(url.pathname));
    if (!target.startsWith(DOCS + path.sep)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const info = await stat(target).catch(() => null);
    if (!info?.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "content-type": TYPES[path.extname(target)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(await readFile(target));
  } catch (err) {
    res.writeHead(500);
    res.end(String(err));
  }
}

createServer((req, res) => {
  void handle(req, res);
}).listen(PORT, () => {
  console.log(`\n  FLEX docs      http://localhost:${String(PORT)}`);
  console.log(
    `  Explorer       http://localhost:${String(PORT)}/architecture/explorer.html\n`,
  );
});
