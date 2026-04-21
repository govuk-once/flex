import fs from "node:fs";
import path from "node:path";

import { jsonSchemaToZod } from "json-schema-to-zod";

import { extractRefName, groupBy, projectRoot, toExpressPath } from "./utils";

interface OpenApiSpec {
  paths?: Record<string, Record<string, OpenApiOperation>>;
  components?: {
    schemas?: Record<string, Record<string, unknown>>;
  };
}

interface OpenApiOperation {
  operationId?: string;
  requestBody?: {
    content?: Record<string, { schema?: Record<string, unknown> }>;
  };
  responses?: Record<
    string,
    { content?: Record<string, { schema?: Record<string, unknown> }> }
  >;
}

interface RouteDefinition {
  method: string;
  path: string;
  name: string;
  access: "public" | "private";
  bodySchemaName?: string;
  responseSchemaName?: string;
}

const VALID_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export function parseOpenApiSpec(spec: OpenApiSpec): RouteDefinition[] {
  const routes: RouteDefinition[] = [];

  Object.entries(spec.paths ?? {}).forEach(([routePath, methods]) => {
    Object.entries(methods).forEach(([method, operation]) => {
      const httpMethod = method.toUpperCase();
      if (!VALID_METHODS.includes(httpMethod)) return;

      const name =
        operation.operationId ??
        `${httpMethod.toLowerCase()}-${slugify(routePath)}`;

      const bodyRef = extractSchemaRef(
        operation.requestBody?.content?.["application/json"]?.schema,
      );
      const responseRef = extractSchemaRef(
        operation.responses?.["200"]?.content?.["application/json"]?.schema,
      );

      routes.push({
        method: httpMethod,
        path: toExpressPath(routePath),
        name,
        access: "public",
        bodySchemaName: bodyRef,
        responseSchemaName: responseRef,
      });
    });
  });

  return routes;
}

function extractSchemaRef(
  schema: Record<string, unknown> | undefined,
): string | undefined {
  if (!schema) return undefined;

  const ref = schema["$ref"] as string | undefined;
  if (ref) return extractRefName(ref);

  return undefined;
}

function slugify(routePath: string): string {
  return routePath
    .replace(/[{}:]/g, "")
    .replace(/\//g, "-")
    .replace(/^-|-$/g, "");
}

function resolveRefs(
  obj: unknown,
  schemas: Record<string, Record<string, unknown>>,
): unknown {
  if (obj === null || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => resolveRefs(item, schemas));
  }

  const record = obj as Record<string, unknown>;

  if (typeof record["$ref"] === "string") {
    const refName = extractRefName(record["$ref"] as string);
    if (refName && schemas[refName]) {
      return resolveRefs(schemas[refName], schemas);
    }
    return record;
  }

  const resolved: Record<string, unknown> = {};
  Object.entries(record).forEach(([key, value]) => {
    resolved[key] = resolveRefs(value, schemas);
  });
  return resolved;
}

export function generateZodSchemas(
  schemas: Record<string, Record<string, unknown>>,
  usedSchemas: Set<string>,
): string {
  const lines: string[] = ['import { z } from "zod";', ""];

  usedSchemas.forEach((name) => {
    const schema = schemas[name];
    if (!schema) return;

    const resolved = resolveRefs(schema, schemas) as Record<string, unknown>;
    const zodCode = jsonSchemaToZod(resolved, { name, module: "none" });
    lines.push(zodCode);
    lines.push("");
    lines.push(`export type ${name} = z.infer<typeof ${name}>;`);
    lines.push("");
  });

  return lines.join("\n");
}

export function generateDomainConfig(
  domainName: string,
  routes: RouteDefinition[],
): string {
  const schemaImports = new Set<string>();

  routes.forEach((route) => {
    if (route.bodySchemaName) schemaImports.add(route.bodySchemaName);
    if (route.responseSchemaName) schemaImports.add(route.responseSchemaName);
  });

  const lines: string[] = [];

  lines.push('import { domain } from "@flex/sdk";');
  if (schemaImports.size > 0) {
    lines.push("");
    lines.push("import {");
    schemaImports.forEach((name) => {
      lines.push(`  ${name},`);
    });
    lines.push('} from "./src/schemas/schemas";');
  }
  lines.push("");

  lines.push("export const { config, route, routeContext } = domain({");
  lines.push(`  name: "${domainName}",`);
  lines.push("  common: {");
  lines.push('    access: "isolated",');
  lines.push("    function: { timeoutSeconds: 30 },");
  lines.push("  },");
  lines.push("  routes: {");

  const byVersion = groupRoutesByVersion(routes);

  Object.entries(byVersion).forEach(([version, versionRoutes]) => {
    lines.push(`    ${version}: {`);

    const byPath = groupBy(versionRoutes, (r) => r.path);

    Object.entries(byPath).forEach(([routePath, pathRoutes]) => {
      lines.push(`      "${routePath}": {`);

      pathRoutes.forEach((route) => {
        lines.push(`        ${route.method}: {`);
        lines.push(`          ${route.access}: {`);
        lines.push(`            name: "${route.name}",`);
        if (route.bodySchemaName) {
          lines.push(`            body: ${route.bodySchemaName},`);
        }
        if (route.responseSchemaName) {
          lines.push(`            response: ${route.responseSchemaName},`);
        }
        lines.push("          },");
        lines.push("        },");
      });

      lines.push("      },");
    });

    lines.push("    },");
  });

  lines.push("  },");
  lines.push("});");
  lines.push("");

  return lines.join("\n");
}

function groupRoutesByVersion(
  routes: RouteDefinition[],
): Record<string, RouteDefinition[]> {
  const groups: Record<string, RouteDefinition[]> = {};

  routes.forEach((route) => {
    const match = route.path.match(/^\/(v\d+)(\/.*)/);

    if (match) {
      const version = match[1];
      groups[version] ??= [];
      groups[version].push({ ...route, path: match[2] });
    } else {
      groups["v1"] ??= [];
      groups["v1"].push(route);
    }
  });

  return groups;
}

function usage(): never {
  console.error(
    "Usage: generate-domain --from <openapi.json> --name <domain>",
  );
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const fromIdx = args.indexOf("--from");
  const nameIdx = args.indexOf("--name");

  if (fromIdx === -1 || nameIdx === -1) usage();

  const specFile = args[fromIdx + 1];
  const domainName = args[nameIdx + 1];

  if (!specFile || !domainName) usage();

  const specPath = path.resolve(specFile);
  if (!fs.existsSync(specPath)) {
    console.error(`File not found: ${specPath}`);
    process.exit(1);
  }

  const spec: OpenApiSpec = JSON.parse(fs.readFileSync(specPath, "utf-8"));
  const routes = parseOpenApiSpec(spec);

  if (routes.length === 0) {
    console.error("No routes found in the OpenAPI spec");
    process.exit(1);
  }

  const domainDir = path.join(projectRoot, "domains", domainName);
  const schemasDir = path.join(domainDir, "src/schemas");
  const domainExists = fs.existsSync(
    path.join(domainDir, "domain.config.ts"),
  );

  fs.mkdirSync(schemasDir, { recursive: true });

  const usedSchemas = new Set<string>();
  routes.forEach((route) => {
    if (route.bodySchemaName) usedSchemas.add(route.bodySchemaName);
    if (route.responseSchemaName) usedSchemas.add(route.responseSchemaName);
  });

  if (usedSchemas.size > 0 && spec.components?.schemas) {
    const zodSource = generateZodSchemas(spec.components.schemas, usedSchemas);
    fs.writeFileSync(path.join(schemasDir, "schemas.ts"), zodSource);
    console.log(`Updated: ${path.join(schemasDir, "schemas.ts")}`);
  }

  const domainConfig = generateDomainConfig(domainName, routes);
  fs.writeFileSync(path.join(domainDir, "domain.config.ts"), domainConfig);
  console.log(
    `${domainExists ? "Updated" : "Generated"}: ${path.join(domainDir, "domain.config.ts")}`,
  );

  console.log(
    `\nDone. ${routes.length} routes. Use git diff to review changes.`,
  );
}

const isDirectRun =
  process.argv[1]?.endsWith("generate-domain.ts") ||
  process.argv[1]?.includes("generate-domain");

if (isDirectRun) {
  main();
}
