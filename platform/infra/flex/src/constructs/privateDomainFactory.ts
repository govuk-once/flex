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
    super(scope, id, domain, httpApi, domainsResource);
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
    // if (permissions && permissions.length > 0) {
    //   this.grantPermissions(handler.role, permissions, domain);
    // }
  }
}
