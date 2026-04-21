import fs from "node:fs";
import path from "node:path";

import { generateOpenApiSpec } from "@flex/sdk/openapi";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const domainsRoot = path.join(projectRoot, "domains");
const outputDir = path.join(projectRoot, "docs/api");

interface DomainModule {
  config?: { name: string; routes: Record<string, unknown> };
}

export function discoverDomainConfigs(rootDir: string): string[] {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(rootDir, entry.name, "domain.config.ts"))
    .filter((configPath) => fs.existsSync(configPath));
}

export async function loadDomainConfig(
  configPath: string,
): Promise<DomainModule | null> {
  let mod: DomainModule;
  try {
    mod = await import(configPath);
  } catch {
    return null;
  }

  if (!mod.config || typeof mod.config !== "object" || !mod.config.routes) {
    return null;
  }

  return mod;
}

function hasChanged(configPath: string, outputPath: string): boolean {
  if (!fs.existsSync(outputPath)) return true;

  const configMtime = fs.statSync(configPath).mtimeMs;
  const outputMtime = fs.statSync(outputPath).mtimeMs;

  return configMtime > outputMtime;
}

export function generateSpecForDomain(
  mod: DomainModule,
  outDir: string,
): string | null {
  if (!mod.config) return null;

  const spec = generateOpenApiSpec(mod.config as never);
  const outputPath = path.join(outDir, `${mod.config.name}.json`);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));

  return mod.config.name;
}

export function generateIndexHtml(domains: string[], outDir: string): string {
  const options = domains
    .map((name) => `            {name: "${name}", url: "./${name}.json"}`)
    .join(",\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>FLEX API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; }
    .swagger-ui .topbar .download-url-wrapper .select-label span {
      visibility: hidden;
    }
    .swagger-ui .topbar .download-url-wrapper .select-label span::before {
      content: "Select a domain";
      visibility: visible;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    SwaggerUIBundle({
      urls: [
${options}
      ],
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      layout: "StandaloneLayout",
    });
  </script>
</body>
</html>`;

  const outputPath = path.join(outDir, "index.html");
  fs.writeFileSync(outputPath, html);
  return outputPath;
}

async function main() {
  const forceAll = process.argv.includes("--force");
  const configPaths = discoverDomainConfigs(domainsRoot);

  fs.mkdirSync(outputDir, { recursive: true });

  const allDomains: string[] = [];
  let regenerated = 0;

  for (const configPath of configPaths) {
    const mod = await loadDomainConfig(configPath);

    if (!mod?.config) {
      const domainName = path.basename(path.dirname(configPath));
      console.warn(`Skipping ${domainName}: no compatible config export`);
      continue;
    }

    const outputPath = path.join(outputDir, `${mod.config.name}.json`);

    if (!forceAll && !hasChanged(configPath, outputPath)) {
      console.log(`Unchanged: ${mod.config.name}`);
      allDomains.push(mod.config.name);
      continue;
    }

    const name = generateSpecForDomain(mod, outputDir);
    if (name) {
      allDomains.push(name);
      regenerated++;
      console.log(`Generated: ${path.join(outputDir, `${name}.json`)}`);
    }
  }

  generateIndexHtml(allDomains, outputDir);

  console.log(
    `\nDone. ${regenerated} regenerated, ${allDomains.length} total domains: ${allDomains.join(", ")}`,
  );
}

main();
