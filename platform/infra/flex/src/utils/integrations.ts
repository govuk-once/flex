import type { DomainIntegration, HttpMethod } from "@flex/sdk";
import { extractRouteKeySegments } from "@flex/sdk";
import type { IRestApi } from "aws-cdk-lib/aws-apigateway";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import type { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

import { toPascalCase } from "./routes";

interface PermissionGrant {
  routePrefix: string;
  method: HttpMethod;
}

function toPermissionGrant(
  { route, type, target }: DomainIntegration,
  domain: string,
): PermissionGrant {
  const prefix = type === "domain" ? "domains" : "gateways";

  const { method, version, path } = extractRouteKeySegments(route);

  return {
    method,
    routePrefix: `/${prefix}/${target ?? domain}/${version}${path}`,
  };
}

function getMethodPermissionGrants(
  permissionGrants: readonly PermissionGrant[],
): ReadonlyMap<HttpMethod, readonly string[]> {
  const grants = new Map<HttpMethod, string[]>();

  for (const { method, routePrefix } of permissionGrants) {
    const group = grants.get(method);

    if (group) {
      if (!group.includes(routePrefix)) group.push(routePrefix);
    } else {
      grants.set(method, [routePrefix]);
    }
  }

  return grants;
}

interface RoutePermissionOption {
  keys: readonly string[];
  integrations: ReadonlyMap<string, DomainIntegration>;
  domain: string;
  api: IRestApi;
}

export function grantRoutePermissions(
  target: NodejsFunction,
  { keys, integrations, domain, api }: RoutePermissionOption,
) {
  if (!target.role || keys.length === 0) return;

  const grants = keys.map((key) => {
    const integration = integrations.get(key);

    if (!integration) {
      throw new Error(
        `"${key}" was referenced in "integrations" but has not been resolved`,
      );
    }

    return toPermissionGrant(integration, domain);
  });

  for (const [method, routes] of getMethodPermissionGrants(grants)) {
    const resources = routes.map((prefix) =>
      api.arnForExecuteApi(method, prefix, "*"),
    );

    target.role.addToPrincipalPolicy(
      new PolicyStatement({
        sid: `AllowApiAccess${toPascalCase(domain)}${method}`,
        effect: Effect.ALLOW,
        actions: ["execute-api:Invoke"],
        resources,
        conditions: { StringEquals: { "execute-api:Method": [method] } },
      }),
    );
  }
}
