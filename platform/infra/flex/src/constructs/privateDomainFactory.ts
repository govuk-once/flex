import { IPermission } from "@flex/sdk";
import { IResource, LambdaIntegration } from "aws-cdk-lib/aws-apigateway";
import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { IRole } from "aws-cdk-lib/aws-iam";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

import { grantPrivateApiAccess } from "../service-gateway/private-gateway-permissions";
import { DomainFactory } from "./domainFactory";

/**
 * Factory for creating private API routes on RestApi (private gateway)
 * Extends DomainFactory to reuse Lambda creation logic but creates RestApi routes instead
 */
export class PrivateDomainFactory extends DomainFactory {
  private readonly domainsResource: IResource;

  constructor(
    scope: Construct,
    id: string,
    domain: string,
    httpApi: HttpApi, // Not used for private routes, but required by parent
    domainsResource: IResource,
  ) {
    super(scope, id, domain, httpApi);
    this.domainsResource = domainsResource;
  }

  /**
   * Override to create RestApi routes instead of HttpApi routes
   */
  protected override createApiRoute(
    httpApi: HttpApi, // Keep signature matching parent
    domain: string,
    version: string,
    path: string,
    method: HttpMethod,
    handler: NodejsFunction,
    permissions?: IPermission[],
  ): void {
    // Build the resource path: /domains/{domain}/{version}{path}
    const fullPath = `/${domain}/${version}${path}`.replace(/\/\//g, "/");
    const segments = fullPath.replace(/^\//, "").split("/").filter(Boolean);

    // Traverse/create nested resources
    let resource = this.domainsResource;
    for (const segment of segments) {
      resource = resource.getResource(segment) ?? resource.addResource(segment);
    }

    // Add the method to RestApi
    resource.addMethod(method, new LambdaIntegration(handler, { proxy: true }));

    // Grant IAM permissions if configured
    if (permissions && permissions.length > 0) {
      this.grantPermissions(handler.role, permissions, domain);
    }
  }

  /**
   * Grants IAM permissions for private API access based on route permissions config
   */
  private grantPermissions(
    role: IRole | undefined,
    permissions: IPermission[],
    domain: string,
  ): void {
    if (!role) return;
    const routePrefixes: string[] = [];
    const methods: string[] = [];

    for (const perm of permissions) {
      let base = "";
      if (perm.type === "domain") {
        const targetDomainId = perm.targetDomainId ?? domain;
        base = `/domains/${targetDomainId}`;
      } else {
        // gateway permissions are only allowed intra-domain
        base = `/gateways/${domain}`;
      }

      const suffix = perm.path.startsWith("/") ? perm.path : `/${perm.path}`;
      routePrefixes.push(`${base}${suffix}`);

      if (perm.method && !methods.includes(perm.method)) {
        methods.push(perm.method);
      }
    }

    if (routePrefixes.length > 0) {
      grantPrivateApiAccess(role, this.domainsResource, {
        domainId: domain,
        allowedRoutePrefixes: routePrefixes,
        allowedMethods: methods.length > 0 ? methods : undefined,
      });
    }
  }
}
