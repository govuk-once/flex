
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

type JsonObject = Record<string, unknown>;

interface DomainEntry {
  name: string;
  spec: string;
}

interface DomainIndex {
  domains: DomainEntry[];
}

interface PublicRoute {
  public?: boolean;
}

type RouteMethods = Record<string, PublicRoute>;
type VersionRoutes = Record<string, RouteMethods>;
type DomainRoutes = Record<string, VersionRoutes>;

interface DomainConfig {
  routes: DomainRoutes;
}

interface OpenApiOperation extends JsonObject {
  operationId?: string;
}

interface OpenApiSpec {
  paths: Record<string, Record<string, OpenApiOperation>>;
  components?: {
    schemas?: Record<string, unknown>;
  };
}

interface MergedOpenApi {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: {
    schemas: Record<string, unknown>;
  };
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJson(filePath: string): unknown {
  const content = fs.readFileSync(filePath, "utf8");
  const parsed: unknown = JSON.parse(content);
  return parsed;
}

function readDomainIndex(filePath: string): DomainIndex {
  const value = readJson(filePath);

  if (!isRecord(value) || !Array.isArray(value.domains)) {
    throw new Error("Invalid OpenAPI index: missing domains array.");
  }

  const domains: DomainEntry[] = [];

  for (const entry of value.domains) {
    if (
      !isRecord(entry) ||
      typeof entry.name !== "string" ||
      typeof entry.spec !== "string"
    ) {
      throw new Error("Invalid domain entry in OpenAPI index.");
    }

    domains.push({
      name: entry.name,
      spec: entry.spec,
    });
  }

  return { domains };
}

function readOpenApiSpec(filePath: string): OpenApiSpec {
  const value = readJson(filePath);

  if (!isRecord(value) || !isRecord(value.paths)) {
    throw new Error(`Invalid OpenAPI paths in ${filePath}`);
  }

  const paths: OpenApiSpec["paths"] = {};

  for (const [routePath, methodsValue] of Object.entries(value.paths)) {
    if (!isRecord(methodsValue)) {
      throw new Error(`Invalid methods for OpenAPI path: ${routePath}`);
    }

    const methods: Record<string, OpenApiOperation> = {};

    for (const [method, operation] of Object.entries(methodsValue)) {
      if (isRecord(operation)) {
        methods[method] = operation;
      }
    }

    paths[routePath] = methods;
  }

  let components: OpenApiSpec["components"];

  if (isRecord(value.components) && isRecord(value.components.schemas)) {
    components = {
      schemas: value.components.schemas,
    };
  }

  return { paths, components };
}

function parseDomainRoutes(value: unknown): DomainRoutes {
  if (!isRecord(value)) {
    throw new Error("Invalid domain routes configuration.");
  }

  const routes: DomainRoutes = {};

  for (const [version, versionValue] of Object.entries(value)) {
    if (!isRecord(versionValue)) {
      throw new Error(`Invalid route configuration for ${version}`);
    }

    routes[version] = {};

    for (const [sdkPath, methodsValue] of Object.entries(versionValue)) {
      if (!isRecord(methodsValue)) {
        throw new Error(`Invalid methods configuration for ${sdkPath}`);
      }

      const methods: RouteMethods = {};

      for (const [method, routeValue] of Object.entries(methodsValue)) {
        if (!isRecord(routeValue)) {
          continue;
        }

        // Public routes may use a boolean or a configuration object.
        // Reject unexpected types rather than silently including them.
        if (
          routeValue.public !== undefined &&
          typeof routeValue.public !== "boolean" &&
          !isRecord(routeValue.public)
        ) {
          throw new Error(`Invalid public flag for ${method} ${sdkPath}`);
        }

        methods[method] = {
          public:
            routeValue.public === true ||
            isRecord(routeValue.public),
        };
      }

      routes[version][sdkPath] = methods;
    }
  }

  return routes;
}

async function loadDomainConfig(configPath: string): Promise<DomainConfig> {
  const imported: unknown = await import(pathToFileURL(configPath).href);

  if (!isRecord(imported) || !isRecord(imported.config)) {
    throw new Error(`Invalid domain config: ${configPath}`);
  }

  return {
    routes: parseDomainRoutes(imported.config.routes ?? {}),
  };
}

async function main(): Promise<void> {
  const domainsRoot = path.resolve("domains");
  const openApiRoot = path.resolve("dist/openapi/current");
  const outputPath = path.resolve("dist/openapi/merged-openapi.json");

  const index = readDomainIndex(path.join(openApiRoot, "index.json"));

  const merged: MergedOpenApi = {
    openapi: "3.1.0",
    info: {
      title: "Flex API - ZAP",
      version: "1.0.0",
    },
    paths: {},
    components: {
      schemas: {},
    },
  };

  const expectedOperations = new Set<string>();

  for (const domain of index.domains) {
    const configPath = path.join(domainsRoot, domain.name, "domain.config.ts");

    const config = await loadDomainConfig(configPath);

    const spec = readOpenApiSpec(path.join(openApiRoot, domain.spec));

    if (spec.components?.schemas) {
      Object.assign(merged.components.schemas, spec.components.schemas);
    }

    for (const [version, routes] of Object.entries(config.routes)) {
      for (const [sdkPath, methods] of Object.entries(routes)) {
        for (const [method, route] of Object.entries(methods)) {
          // Only scan explicitly public API routes.
          if (!route.public) {
            continue;
          }

          const openApiPath = `/app/${domain.name}/${version}${sdkPath}`
            .replace(/:([A-Za-z_]\w*)/g, "{$1}")
            .replace(/\[([A-Za-z_]\w*)\]/g, "{$1}");

          const normalizedMethod = method.toLowerCase();

          const operation = spec.paths[openApiPath]?.[normalizedMethod];

          if (!operation) {
            throw new Error(
              `Missing generated operation: ${method} ${openApiPath}`,
            );
          }

          const operationKey = `${normalizedMethod} ${openApiPath}`;

          if (expectedOperations.has(operationKey)) {
            throw new Error(`Duplicate public API operation: ${operationKey}`);
          }

          expectedOperations.add(operationKey);

          merged.paths[openApiPath] ??= {};

          const zapOperation = structuredClone(operation);

          zapOperation.operationId =
            `${domain.name}-${version}-${normalizedMethod}-${sdkPath}`
              .replace(/[^A-Za-z0-9_-]/g, "-")
              .replace(/-+/g, "-")
              .replace(/^-|-$/g, "");

          merged.paths[openApiPath][normalizedMethod] = zapOperation;

          console.log(`Included: ${method} ${openApiPath}`);
        }
      }
    }
  }

  if (expectedOperations.size === 0) {
    throw new Error("No public API operations were found for the ZAP scan.");
  }

  const mergedOperations = new Set(
    Object.entries(merged.paths).flatMap(([routePath, methods]) =>
      Object.keys(methods).map((method) => `${method} ${routePath}`),
    ),
  );

  const missingOperations = [...expectedOperations].filter(
    (operation) => !mergedOperations.has(operation),
  );

  const unexpectedOperations = [...mergedOperations].filter(
    (operation) => !expectedOperations.has(operation),
  );

  if (missingOperations.length || unexpectedOperations.length) {
    throw new Error(
      `OpenAPI merge mismatch. Missing: ${
        missingOperations.join(", ") || "none"
      }; unexpected: ${unexpectedOperations.join(", ") || "none"}`,
    );
  }

  console.log(
    `Validated ${String(expectedOperations.size)} public API operations.`,
  );

  fs.mkdirSync(path.dirname(outputPath), {
    recursive: true,
  });

  fs.writeFileSync(outputPath, `${JSON.stringify(merged, null, 2)}\n`);

  console.log(
    `Merged ${String(Object.keys(merged.paths).length)} public paths for ZAP.`,
  );

  console.log(
    `Merged ${String(Object.keys(merged.components.schemas).length)} component schemas.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});