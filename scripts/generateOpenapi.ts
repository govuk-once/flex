import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { ZodType } from "zod";
import type {
  ZodOpenApiOperationObject,
  ZodOpenApiParameterObject,
  ZodOpenApiParameters,
  ZodOpenApiPathsObject,
} from "zod-openapi";
import { createDocument } from "zod-openapi";

// Output is a temporary build location: generated specs are uploaded to S3
// by CI and never committed. The directory is wiped on every run.
const DOMAINS_ROOT = resolve("domains");
const OUTPUT_ROOT = resolve("dist/openapi/current");

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

interface RouteConfig {
  name: string;
  body?: ZodType;
  query?: ZodType;
  response?: ZodType;
  headers?: Record<string, { name: string; required?: boolean }>;
}

interface DomainConfig {
  routes?: Record<
    string, // version, e.g. "v1"
    Record<
      string, // sdk path, e.g. "/identity/:service"
      Partial<
        Record<HttpMethod, { public?: RouteConfig; private?: RouteConfig }>
      >
    >
  >;
}

/** Normalize `:param` and `[param]` segments to OpenAPI `{param}` form. */
function toOpenApiPath(sdkPath: string) {
  return sdkPath
    .replace(/:([A-Za-z_]\w*)/g, "{$1}")
    .replace(/\[([A-Za-z_]\w*)\]/g, "{$1}");
}

function buildResponses(response: ZodType | undefined) {
  if (!response) {
    return {
      "200": {
        description: "Successful response.",
      },
    };
  }
  return {
    "200": {
      description: "Successful response.",
      content: {
        "application/json": { schema: response },
      },
    },
  };
}

function buildOperation(
  method: HttpMethod,
  sdkPath: string,
  openApiPath: string,
  route: RouteConfig,
) {
  const operation: ZodOpenApiOperationObject = {
    operationId: route.name,
    summary: `${method} ${sdkPath}`,
    responses: buildResponses(route.response),
  };

  const parameters: ZodOpenApiParameterObject[] = [];
  // Path params fall straight out of the already-normalized path.
  for (const [, name = ""] of openApiPath.matchAll(/\{(\w+)\}/g)) {
    parameters.push({
      in: "path",
      name,
      required: true,
      schema: { type: "string" },
    });
  }
  for (const header of Object.values(route.headers ?? {})) {
    parameters.push({
      in: "header",
      name: header.name,
      required: header.required ?? false,
      schema: { type: "string" },
    });
  }
  if (parameters.length > 0) {
    operation.parameters = parameters;
  }

  if (route.body) {
    operation.requestBody = {
      required: true,
      content: { "application/json": { schema: route.body } },
    };
  }
  if (route.query) {
    operation.requestParams = {
      query: route.query as ZodOpenApiParameters["query"],
    };
  }

  return operation;
}

function buildPaths(name: string, config: DomainConfig) {
  const paths: ZodOpenApiPathsObject = {};

  for (const [version, routes] of Object.entries(config.routes ?? {})) {
    for (const [sdkPath, byMethod] of Object.entries(routes)) {
      for (const method of HTTP_METHODS) {
        // Private wins on collision (only udp's GET /identity/:service
        // today): the private declaration carries the richer contract -
        // required headers, response schemas - that the public one omits.
        const route = byMethod[method]?.private ?? byMethod[method]?.public;
        if (!route) continue;

        const openApiPath = `/app/${name}/${version}${toOpenApiPath(sdkPath)}`;
        paths[openApiPath] ??= {};
        paths[openApiPath][method.toLowerCase() as Lowercase<HttpMethod>] =
          buildOperation(method, sdkPath, openApiPath, route);
      }
    }
  }

  return paths;
}

function buildDomainDocument(name: string, config: DomainConfig) {
  return createDocument({
    openapi: "3.1.0",
    info: {
      title: `${name} domain`,
      version: "1.0.0",
    },
    paths: buildPaths(name, config),
  });
}

function discoverDomains() {
  if (!existsSync(DOMAINS_ROOT)) return [];

  const domains: { name: string; configPath: string }[] = [];
  for (const entry of readdirSync(DOMAINS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const configPath = resolve(DOMAINS_ROOT, entry.name, "domain.config.ts");
    if (existsSync(configPath)) domains.push({ name: entry.name, configPath });
  }
  return domains.sort((a, b) => a.name.localeCompare(b.name));
}

async function loadDomainConfig(configPath: string) {
  const { config } = (await import(pathToFileURL(configPath).href)) as {
    config?: DomainConfig;
  };
  if (!config || typeof config !== "object") {
    throw new Error(`${configPath} does not export a \`config\` object`);
  }
  return config;
}

async function main() {
  const domains = discoverDomains();
  if (domains.length === 0) {
    console.error(`no domains found under ${DOMAINS_ROOT}`);
    return 1;
  }

  console.log(`generating openapi for ${String(domains.length)} domain(s):`);
  rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  mkdirSync(OUTPUT_ROOT, { recursive: true });

  const index = [];
  for (const { name, configPath } of domains) {
    const config = await loadDomainConfig(configPath);
    const doc = buildDomainDocument(name, config);
    const outputPath = resolve(OUTPUT_ROOT, `${name}.json`);
    writeFileSync(outputPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
    index.push({ name, spec: `${name}.json` });
    console.log(`  → ${name}: ${outputPath}`);
  }

  writeFileSync(
    resolve(OUTPUT_ROOT, "index.json"),
    `${JSON.stringify({ domains: index }, null, 2)}\n`,
    "utf8",
  );
  console.log(`done - ${String(index.length)} document(s) + index written.`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  });
