import {
  IResource,
  LambdaIntegration,
  Method,
} from "aws-cdk-lib/aws-apigateway";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

/**
 * Options for attaching a Lambda to a route. Use proxy: true for greedy path
 * (e.g. /user -> /user, /user/123, /user/123/foo).
 */
export interface PrivateRouteOptions {
  /** Use proxy integration (lambda receives full path and request). Default true. */
  readonly proxy?: boolean;
}

/**
 * Mirror of RouteGroup for the private API: adds routes under
 * /internal/{gateways|domains}/{domainId}/...
 *
 * Use this to attach Lambdas to the private API so they are only callable
 * from other Flex components (with execute-api:Invoke permission).
 *
 * Attachment patterns:
 * - Public only: use RouteGroup.addRoute on the HTTP API (no PrivateRouteGroup).
 * - Private only: use only this PrivateRouteGroup.addRoute (do not add to public API).
 * - Both: call both RouteGroup.addRoute and PrivateRouteGroup.addRoute with the same Lambda.
 *
 * Callers that need to invoke these internal routes must be granted
 * execute-api:Invoke via grantPrivateApiAccess() with allowedRoutePrefixes
 * e.g. ["/internal/domains/udp/*" or "/internal/gateways/udp/*"].
 */
export class PrivateRouteGroup extends Construct {
  private readonly domainResource: IResource;
  private readonly gatewayResource: IResource;
  constructor(
    scope: Construct,
    id: string,
    private props: {
      /** Pre-created /internal/domains resource from createPrivateGateway() */
      domains: IResource;
      /** Pre-created /internal/gateways resource from createPrivateGateway() */
      gateways: IResource;
      /** Domain id, e.g. "udp" -> routes under /internal/domains/udp/... */
      domainId: string;
    },
  ) {
    super(scope, id);
    this.domainResource = props.domains.addResource(props.domainId);
    this.gatewayResource = props.gateways.addResource(props.domainId);
  }

  /**
   * Add a route under /internal/{gateways|domains}/{domainId}/{path}.
   * Method is the HTTP method (GET, POST, PATCH, etc.); use "ANY" for all methods.
   */
  public addRoute(
    type: "domain" | "gateway",
    path: string,
    method: string,
    handler: IFunction,
    options: PrivateRouteOptions = {},
  ): Method {
    const proxy = options.proxy !== false;
    const pathSegments = path.replace(/^\//, "").split("/").filter(Boolean);
    const resource = pathSegments.reduce(
      (parent, segment) =>
        parent.getResource(segment) ?? parent.addResource(segment),
      type === "domain" ? this.domainResource : this.gatewayResource,
    );
    return resource.addMethod(
      method,
      new LambdaIntegration(handler, { proxy }),
    );
  }

  /** Full path prefix for this domain, for IAM and grantPrivateApiAccess. */
  public get pathPrefix(): string {
    return `/internal/domains/${this.props.domainId}`;
  }
}
