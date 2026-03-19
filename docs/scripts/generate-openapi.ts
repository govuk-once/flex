import { glob } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";

import { createDocument } from "zod-openapi";
import { stringify } from "yaml";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const projectRoot = path.resolve(import.meta.dirname, "../..");
const domainsRoot = path.join(projectRoot, "domains");
const outputPath = path.join(projectRoot, "docs/api/openapi.yaml");

// ---------------------------------------------------------------------------
// Types (mirrors the two domain config patterns in this repo)
// ---------------------------------------------------------------------------

interface LegacyDomain {
  domain: string;
  versions: Record<
    string,
    { routes: Record<string, Record<string, unknown>> }
  >;
}

interface NewPublicRouteConfig {
  name: string;
  body?: unknown;
  response?: unknown;
  query?: unknown;
}

interface NewGatewayConfig {
  public?: NewPublicRouteConfig;
  private?: unknown;
}

interface NewDomainConfig {
  name: string;
  routes: Record<
    string,
    Record<string, Record<string, NewGatewayConfig>>
  >;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert Express-style path params (`:param`) to OpenAPI style (`{param}`).
 * The `defineDomain()` pattern already uses `{param}` style, so this is a
 * no-op for those routes.
 */
function normalizePathParams(routePath: string): string {
  return routePath.replace(/:(\w+)/g, "{$1}");
}

function buildOperation(routeConfig?: NewPublicRouteConfig) {
  type Responses = Record<
    string,
    { description: string; content?: Record<string, { schema: unknown }> }
  >;

  const responses: Responses = {
    401: { description: "Unauthorised" },
    403: { description: "Forbidden" },
    500: { description: "Internal server error" },
  };

  if (routeConfig?.response) {
    responses[200] = {
      description: "Successful response",
      content: {
        "application/json": { schema: routeConfig.response },
      },
    };
  } else {
    responses[200] = { description: "Successful response" };
  }

  const operation: Record<string, unknown> = { responses };

  if (routeConfig?.body) {
    operation.requestBody = {
      content: {
        "application/json": { schema: routeConfig.body },
      },
    };
  }

  return operation;
}

// ---------------------------------------------------------------------------
// Discovery & extraction
// ---------------------------------------------------------------------------

async function generatePaths(): Promise<Record<string, Record<string, unknown>>> {
  const paths: Record<string, Record<string, unknown>> = {};

  for await (const entry of glob("*/domain.config.ts", { cwd: domainsRoot })) {
    const absolutePath = path.join(domainsRoot, entry);

    let mod: Record<string, unknown>;
    try {
      mod = await import(absolutePath);
    } catch (err) {
      console.warn(`Skipping ${absolutePath}: failed to import — ${err}`);
      continue;
    }

    // ------------------------------------------------------------------
    // Pattern 1: defineDomain() — exported as `endpoints`
    //
    // Used by: hello, udp
    // All routes in domain.config.ts are on the public API gateway.
    // The `type` field controls Lambda network access only, not visibility.
    // ------------------------------------------------------------------
    if (mod.endpoints && typeof mod.endpoints === "object") {
      const legacy = mod.endpoints as LegacyDomain;

      for (const [version, versionConfig] of Object.entries(legacy.versions)) {
        for (const [routePath, methods] of Object.entries(
          versionConfig.routes,
        )) {
          for (const [method] of Object.entries(methods)) {
            const normalized = normalizePathParams(routePath);
            const fullPath = `/${legacy.domain}/${version}${normalized}`;

            paths[fullPath] ??= {};
            paths[fullPath][method.toLowerCase()] = buildOperation();
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // Pattern 2: domain() — exported as `config`
    //
    // Used by: poc
    // Route visibility is determined by presence of a `public` key.
    // Zod schemas may be attached to `public.body`, `public.response`,
    // and `public.query`.
    // ------------------------------------------------------------------
    if (mod.config && typeof mod.config === "object") {
      const config = mod.config as NewDomainConfig;

      for (const [version, versionRoutes] of Object.entries(config.routes)) {
        for (const [routePath, methods] of Object.entries(versionRoutes)) {
          for (const [method, gatewayConfig] of Object.entries(methods)) {
            if (!gatewayConfig?.public) continue;

            const normalized = normalizePathParams(routePath);
            const fullPath = `/${config.name}/${version}${normalized}`;

            paths[fullPath] ??= {};
            paths[fullPath][method.toLowerCase()] = buildOperation(
              gatewayConfig.public,
            );
          }
        }
      }
    }
  }

  return paths;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const paths = await generatePaths();

const doc = createDocument({
  openapi: "3.1.0",
  info: {
    title: "Flex API",
    version: "1.0.0",
    description: "Public API for the GOV.UK Flex platform.",
  },
  servers: [
    {
      url: "https://api.staging.flex.service.gov.uk",
      description: "Staging",
    },
    {
      url: "{baseUrl}",
      description: "Ephemeral environment",
      variables: {
        baseUrl: {
          default: "https://api.staging.flex.service.gov.uk",
          description: "Base URL for the ephemeral environment",
        },
      },
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  paths: paths as any,
  security: [{ BearerAuth: [] }],
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, stringify(doc));

console.log(`OpenAPI spec written to: ${outputPath}`);
