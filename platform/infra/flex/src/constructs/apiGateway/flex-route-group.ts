import {
  HttpApi,
  HttpMethod,
  HttpRouteIntegration,
} from "aws-cdk-lib/aws-apigatewayv2";
import { Construct } from "constructs";

interface RouteGroupProps {
  readonly httpApi: HttpApi;
  readonly version: `v${bigint}`;
}

export class RouteGroup extends Construct {
  constructor(
    scope: Construct,
    id: string,
    private props: RouteGroupProps,
  ) {
    super(scope, id);
  }

  public addRoute(
    path: string,
    method: HttpMethod,
    integration: HttpRouteIntegration,
  ) {
    // Combine prefix with path
    // logic handles missing or duplicate slashes for safety
    const fullPath = `/app/${this.props.version}/${path}`.replace("//", "/");

    this.props.httpApi.addRoutes({
      path: fullPath,
      methods: [method],
      integration: integration,
    });
  }
}
