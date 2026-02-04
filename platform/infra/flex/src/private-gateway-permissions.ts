import { RestApi } from "aws-cdk-lib/aws-apigateway";
import { Effect, IRole, PolicyStatement, Role } from "aws-cdk-lib/aws-iam";

/**
 * Configuration for which routes a domain/service can call on the private API gateway.
 */
export interface DomainRoutePermissions {
  /**
   * Domain/service identifier (e.g. "udp", "hello", "payments")
   */
  domainId: string;

  /**
   * Route prefixes this domain is allowed to call.
   *
   * Examples:
   * - ["/internal/gateways/dvla/*"] - Can call DVLA gateway
   * - ["/internal/domains/users/*"] - Can call users domain
   * - ["/internal/gateways/*", "/internal/domains/users/*"] - Can call all gateways and users domain
   *
   * Use "*" for all routes (not recommended for production).
   */
  allowedRoutePrefixes: string[];

  /**
   * Optional: Specific HTTP methods allowed (defaults to all if not specified).
   */
  allowedMethods?: string[];
}

/**
 * Grants a domain lambda role permission to invoke specific routes on the private API gateway.
 *
 * This enforces least-privilege: each domain can only call routes it's explicitly allowed to access.
 *
 * Example usage:
 * ```ts
 * const udpFunction = new FlexPrivateIsolatedFunction(...);
 * grantPrivateApiAccess(udpFunction.function.role!, privateGateway, {
 *   domainId: "udp",
 *   allowedRoutePrefixes: [
 *     "/internal/gateways/dvla/*",
 *     "/internal/domains/users/*"
 *   ]
 * });
 * ```
 */
export function grantPrivateApiAccess(
  role: IRole | undefined, // role may be undefined at synth time
  privateGateway: RestApi,
  permissions: DomainRoutePermissions,
): void {
  if (!role) {
    return;
  }

  const methods = permissions.allowedMethods ?? ["*"];
  const resources = permissions.allowedRoutePrefixes.map(
    (prefix) => `${privateGateway.arnForExecuteApi("*", prefix, "*")}`,
  );

  role.addToPrincipalPolicy(
    new PolicyStatement({
      sid: `AllowPrivateApiAccess-${permissions.domainId}`,
      effect: Effect.ALLOW,
      actions: ["execute-api:Invoke"],
      resources:
        resources.length > 0
          ? resources
          : [`${privateGateway.arnForExecuteApi("*", "/*", "*")}`],
      conditions:
        methods.length > 0 && !methods.includes("*")
          ? {
              StringEquals: {
                "execute-api:Method": methods,
              },
            }
          : undefined,
    }),
  );
}

/**
 * Domain dependency matrix: defines which domains can call which other domains/gateways.
 *
 * This is a central registry that can be used to:
 * 1. Generate IAM policies automatically
 * 2. Validate dependencies at deploy time
 * 3. Document cross-domain dependencies
 * 4. Enforce runtime authorization (if implementing middleware)
 *
 * Example:
 * ```ts
 * const domainDependencies: DomainDependencyMatrix = {
 *   udp: {
 *     gateways: ["dvla"],
 *     domains: ["users"],
 *   },
 *   payments: {
 *     gateways: [],
 *     domains: ["users", "orders"],
 *   },
 * };
 * ```
 */
export interface DomainDependencyMatrix {
  [domainId: string]: {
    gateways: string[];
    domains: string[];
  };
}

/**
 * Converts a domain dependency matrix into route prefixes for IAM policy generation.
 */
export function dependencyMatrixToRoutePrefixes(
  domainId: string,
  matrix: DomainDependencyMatrix,
): string[] {
  const deps = matrix[domainId];
  if (!deps) {
    return [];
  }

  const prefixes: string[] = [];

  // Add gateway routes
  deps.gateways.forEach((gatewayId) => {
    prefixes.push(`/internal/gateways/${gatewayId}/*`);
  });

  // Add domain routes
  deps.domains.forEach((targetDomainId) => {
    prefixes.push(`/internal/domains/${targetDomainId}/*`);
  });

  return prefixes;
}

/**
 * Grants private API access to multiple domains based on a dependency matrix.
 *
 * Example:
 * ```ts
 * const matrix: DomainDependencyMatrix = {
 *   udp: { gateways: ["dvla"], domains: [] },
 * };
 *
 * grantPrivateApiAccessFromMatrix(
 *   { udp: udpFunction.role! },
 *   privateGateway,
 *   matrix
 * );
 * ```
 */
export function grantPrivateApiAccessFromMatrix(
  domainRoles: Record<string, Role>,
  privateGateway: RestApi,
  matrix: DomainDependencyMatrix,
): void {
  Object.entries(domainRoles).forEach(([domainId, role]) => {
    const routePrefixes = dependencyMatrixToRoutePrefixes(domainId, matrix);

    if (routePrefixes.length === 0) {
      console.warn(
        `Domain ${domainId} has no dependencies defined in matrix. ` +
          "It will not be granted access to any private API routes.",
      );
      return;
    }

    grantPrivateApiAccess(role, privateGateway, {
      domainId,
      allowedRoutePrefixes: routePrefixes,
    });
  });
}
