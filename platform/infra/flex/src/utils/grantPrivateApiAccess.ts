import crypto from "node:crypto";

import { IRestApi, RestApi } from "aws-cdk-lib/aws-apigateway";
import { Effect, IRole, PolicyStatement } from "aws-cdk-lib/aws-iam";

/**
 * Configuration for which routes a domain/service can call on the private API gateway.
 */
interface RoutePermissions {
  /**
   * Domain/service identifier (e.g. "udp", "hello", "payments")
   */
  domainId: string;

  /**
   * Route prefixes this domain is allowed to call.
   * An empty array means this Lambda makes no outbound private API calls — no IAM grant is added.
   *
   * Examples:
   * - ["/gateways/dvla/*"] - Can call DVLA gateway
   * - ["/domains/users/*"] - Can call users domain
   * - ["/gateways/*", "/domains/users/*"] - Can call all gateways and users domain
   *
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
 * grantPrivateApiAccess(udpFunction.function.role, privateGateway, {
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
  api: IRestApi | RestApi,
  permissions: RoutePermissions,
): void {
  if (!role) {
    return;
  }

  if (permissions.allowedRoutePrefixes.length === 0) {
    return; // No outbound private API calls needed — nothing to grant.
  }

  const methods = permissions.allowedMethods ?? ["*"];

  // Build one ARN per (method, prefix) pair so the method is encoded directly
  // in the resource ARN rather than relying on a condition.
  const resources = methods.flatMap((method) =>
    permissions.allowedRoutePrefixes.map((prefix) =>
      api.arnForExecuteApi(method, prefix, "*"),
    ),
  );

  const hash = crypto
    .createHash("md5")
    .update(resources.join("|"))
    .digest("hex")
    .slice(0, 8);

  role.addToPrincipalPolicy(
    new PolicyStatement({
      sid: `AllowPrivateApiAccess${permissions.domainId}${hash}`,
      effect: Effect.ALLOW,
      actions: ["execute-api:Invoke"],
      resources,
    }),
  );
}
