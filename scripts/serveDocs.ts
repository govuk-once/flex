import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";

const PORT = Number(process.env.DOCS_PORT) || 4400;

const DOCS_UI = resolve("platform/infra/flex/src/docs");
const SPECS = resolve("dist/openapi/current");

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".txt": "text/plain",
};

function serveFile(filePath: string): { body: Buffer; mime: string } | null {
  if (!existsSync(filePath)) return null;
  const body = readFileSync(filePath);
  const mime = MIME[extname(filePath)] ?? "application/octet-stream";
  return { body, mime };
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${String(PORT)}`);
  const path = url.pathname;

  if (path === "/" || path === "/docs" || path === "/docs/") {
    res.writeHead(302, { Location: "/docs/index.html" });
    res.end();
    return;
  }

  if (!path.startsWith("/docs/")) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }

  const relative = path.slice("/docs/".length);

  // Try the static UI files first (index.html, init.js, vendor/*)
  const uiFile = resolve(DOCS_UI, relative);
  const uiResult = serveFile(uiFile);
  if (uiResult) {
    res.writeHead(200, { "Content-Type": uiResult.mime });
    res.end(uiResult.body);
    return;
  }

  // Then try the generated specs (index.json, dvla.json, etc.)
  const specFile = resolve(SPECS, relative);
  const specResult = serveFile(specFile);
  if (specResult) {
    res.writeHead(200, { "Content-Type": specResult.mime });
    res.end(specResult.body);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`docs server running at http://localhost:${String(PORT)}/docs/`);
});
