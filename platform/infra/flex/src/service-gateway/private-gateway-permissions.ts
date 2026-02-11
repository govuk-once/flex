import { IResource } from "aws-cdk-lib/aws-apigateway";
import { Effect, IRole, PolicyStatement, Role } from "aws-cdk-lib/aws-iam";


/**
 * Configuration for which routes a domain/service can call on the private API gateway.
 */
interface DomainRoutePermissions {
  /**
   * Domain/service identifier (e.g. "udp", "hello", "payments")
   */
  domainId: "udp" | "hello" | "dvla";

  /**
   * Route prefixes this domain is allowed to call.
   *
   * Examples:
   * - ["/gateways/dvla/*"] - Can call DVLA gateway
   * - ["/domains/users/*"] - Can call users domain
   * - ["/gateways/*", "/domains/users/*"] - Can call all gateways and users domain
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
 *     "/gateways/dvla/*",
 *     "/domains/users/*"
 *   ]
 * });
 * ```
 */
export function grantPrivateApiAccess(
  role: IRole | undefined, // role may be undefined at synth time
  domainsResource: IResource,
  permissions: DomainRoutePermissions,
): void {
  if (!role) {
    return;
  }

  if (permissions.allowedRoutePrefixes.length === 0) {
    throw new Error(
      `grantPrivateApiAccess: domain "${permissions.domainId}" must specify at least one allowedRoutePrefix. ` +
      `Use ["/*"] explicitly if you intend to allow all routes.`
    );
  }

  const methods = permissions.allowedMethods ?? ["*"];
  const resources = permissions.allowedRoutePrefixes.map((prefix) =>
    domainsResource.api.arnForExecuteApi("*", prefix, "*"),
  );

  role.addToPrincipalPolicy(
    new PolicyStatement({
      sid: `AllowPrivateApiAccess${permissions.domainId}`,
      effect: Effect.ALLOW,
      actions: ["execute-api:Invoke"],
      resources,
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
