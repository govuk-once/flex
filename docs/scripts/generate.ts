import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { mapContract } from "./lib/flex-mapper.ts";

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

const ROUTE_KEY_PATTERN = /^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)(?:\s+\[(\w+)])?$/;

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const DOMAINS_DIR = join(REPO_ROOT, "domains");
const OUTPUT_DIR = join(REPO_ROOT, "docs", "api");

function listDomainsWithContract(): string[] {
  return readdirSync(DOMAINS_DIR)
    .filter((entry) => statSync(join(DOMAINS_DIR, entry)).isDirectory())
    .filter((entry) => {
      try {
        return statSync(join(DOMAINS_DIR, entry, "contract.json")).isFile();
      } catch {
        return false;
      }
    });
}

function readJson(path: string): JsonObject {
  return JSON.parse(readFileSync(path, "utf8")) as JsonObject;
}

function writeJson(path: string, value: JsonObject): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function flexRouteKeyToOpenApi(key: string): { path: string; method: string; access?: string } | null {
  const match = key.match(ROUTE_KEY_PATTERN);
  if (!match) return null;
  return { method: match[1].toLowerCase(), path: match[2], access: match[3] };
}

function flexToOpenApiShape(flex: JsonObject): JsonObject {
  const info: JsonObject = {
    title: (flex.name as string) ?? "untitled",
    version: (flex.version as string) ?? "1.0.0",
  };
  if (typeof flex.description === "string") info.description = flex.description;
  if (Array.isArray(flex["x-flex-default-errors"])) {
    info["x-flex-default-errors"] = flex["x-flex-default-errors"];
  }

  const paths: JsonObject = {};
  const rawRoutes = (flex.routes ?? {}) as JsonObject;
  Object.entries(rawRoutes).forEach(([rawKey, op]) => {
    const parsed = flexRouteKeyToOpenApi(rawKey);
    if (!parsed) return;
    const operation = { ...(op as JsonObject) };
    if (parsed.access) operation["x-flex-access"] = parsed.access;
    const pathItem = (paths[parsed.path] as JsonObject | undefined) ?? {};
    pathItem[parsed.method] = operation;
    paths[parsed.path] = pathItem;
  });

  const result: JsonObject = {
    openapi: "3.1.0",
    info,
    paths,
  };

  if (flex.schemas) {
    result.components = { schemas: flex.schemas };
  }

  return result;
}

function generateForDomain(domain: string): void {
  const flex = readJson(join(DOMAINS_DIR, domain, "contract.json"));
  const openApiShape = flexToOpenApiShape(flex);
  const expanded = mapContract(openApiShape);
  writeJson(join(OUTPUT_DIR, `${domain}.json`), expanded);
  console.log(`generated docs/api/${domain}.json`);
}

const domains = listDomainsWithContract();
domains.forEach(generateForDomain);
console.log(`\ngenerated ${domains.length} OpenAPI spec(s) in docs/api/`);
