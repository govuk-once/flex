import type { ZodType } from "zod";
import { createDocument, type oas31, type ZodOpenApiObject } from "zod-openapi";

import type { DomainConfig } from "../types";

type AccessLevel = "public" | "private";

interface RouteEntry {
  method: string;
  path: string;
  access: AccessLevel;
  name: string;
  body?: ZodType;
  response?: ZodType;
  headers?: Record<string, { name: string; required?: boolean }>;
}

function extractRoutes(config: DomainConfig): RouteEntry[] {
  const routes: RouteEntry[] = [];

  for (const [version, paths] of Object.entries(config.routes)) {
    for (const [path, methods] of Object.entries(
      paths as Record<string, Record<string, unknown>>,
    )) {
      for (const [method, gatewayConfig] of Object.entries(
        methods as Record<string, Record<string, unknown>>,
      )) {
        const gateway = gatewayConfig as {
          public?: Record<string, unknown>;
          private?: Record<string, unknown>;
        };

        for (const access of ["public", "private"] as const) {
          const routeConfig = gateway[access];
          if (!routeConfig) continue;

          const openApiPath = `/${version}${path}`.replace(/:(\w+)/g, "{$1}");

          routes.push({
            method: method.toLowerCase(),
            path: openApiPath,
            access,
            name: routeConfig.name as string,
            body: routeConfig.body as ZodType | undefined,
            response: routeConfig.response as ZodType | undefined,
            headers: routeConfig.headers as RouteEntry["headers"],
          });
        }
      }
    }
  }

  return routes;
}

function extractPathParams(path: string): string[] {
  const matches = path.match(/\{(\w+)\}/g);
  return matches ? matches.map((m) => m.slice(1, -1)) : [];
}

function buildPathItem(route: RouteEntry) {
  const operation: Record<string, unknown> = {
    operationId: route.name,
    tags: [route.access],
  };

  const parameters: Record<string, unknown>[] = [];

  for (const param of extractPathParams(route.path)) {
    parameters.push({
      name: param,
      in: "path" as const,
      required: true,
      schema: { type: "string" },
    });
  }

  if (route.headers) {
    for (const [, headerConfig] of Object.entries(route.headers)) {
      parameters.push({
        name: headerConfig.name,
        in: "header" as const,
        required: headerConfig.required ?? false,
        schema: { type: "string" },
      });
    }
  }

  if (parameters.length > 0) {
    operation.parameters = parameters;
  }

  if (route.body) {
    operation.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: route.body,
        },
      },
    };
  }

  const responses: Record<string, unknown> = {};

  if (route.response) {
    responses["200"] = {
      description: "Successful response",
      content: {
        "application/json": {
          schema: route.response,
        },
      },
    };
  } else {
    responses["204"] = {
      description: "No content",
    };
  }

  responses["400"] = { description: "Bad request" };
  responses["404"] = { description: "Not found" };
  responses["502"] = { description: "Bad gateway" };

  operation.responses = responses;

  return operation;
}

export function generateOpenApiSpec(config: DomainConfig): oas31.OpenAPIObject {
  const routes = extractRoutes(config);

  const paths: ZodOpenApiObject["paths"] = {};

  for (const route of routes) {
    if (!paths[route.path]) {
      paths[route.path] = {};
    }
    (paths[route.path] as Record<string, unknown>)[route.method] =
      buildPathItem(route);
  }

  return createDocument({
    openapi: "3.1.0",
    info: {
      title: `${config.name} API`,
      version: "1.0.0",
      description: `API documentation for the ${config.name} domain`,
    },
    paths,
    tags: [
      { name: "public", description: "Authenticated public routes" },
      { name: "private", description: "Internal service-to-service routes" },
    ],
  });
}
