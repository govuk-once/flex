import { IDomainRoutes } from "@flex/sdk";
import {
  AuthorizationType,
  IResource,
  LambdaIntegration,
} from "aws-cdk-lib/aws-apigateway";
import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

import { processDomainRoutes } from "../utils/processDomainRoutes";

/**
 * Construct for creating private API routes on RestApi (private gateway).
 * Extends Construct (not Stack) so resources are created in the parent stack,
 * avoiding the cyclic dependency that occurs when nesting stacks.
 */
export class PrivateDomainFactory extends Construct {
  constructor(
    scope: Construct,
    id: string,
    private readonly props: {
      domain: string;
      httpApi: HttpApi; // Not used for private routes, but kept for API consistency
      domainsResource: IResource;
    },
  ) {
    super(scope, id);
  }

  processRoutes(versionedRoutes: IDomainRoutes) {
    processDomainRoutes(this, {
      domain: this.props.domain,
      versionedRoutes,
      domainsResource: this.props.domainsResource,
      createApiRoute: (domain, version, path, method, handler) => {
        this.addRestApiRoute(domain, version, path, method, handler);
      },
    });
  }

  private addRestApiRoute(
    domain: string,
    version: string,
    path: string,
    method: HttpMethod,
    handler: NodejsFunction,
  ): void {
    const fullPath = `/${domain}/${version}${path}`.replace(/\/\//g, "/");
    const segments = fullPath.replace(/^\//, "").split("/").filter(Boolean);

    let resource: IResource = this.props.domainsResource;
    for (const segment of segments) {
      resource = resource.getResource(segment) ?? resource.addResource(segment);
    }

    resource.addMethod(
      method,
      new LambdaIntegration(handler, { proxy: true }),
      {
        authorizationType: AuthorizationType.IAM,
      },
    );
  }
}
