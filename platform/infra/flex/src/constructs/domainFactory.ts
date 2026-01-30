import { IDomainEndpoint, IRoutes } from "@flex/iac";
import { NestedStack } from "aws-cdk-lib";
import { HttpApi } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";

import { getEntry } from "../utils/getEntry";
import { FlexPrivateEgressFunction } from "./lambda/flex-private-egress-function";
import { FlexPrivateIsolatedFunction } from "./lambda/flex-private-isolated-function";
import { FlexPublicFunction } from "./lambda/flex-public-function";

export class domainFactory extends NestedStack {
  constructor(
    scope: Construct,
    id: string,
    domainRoutes: IRoutes,
    httpApi: HttpApi,
  ) {
    super(scope, id);
    const { routes, domain } = domainRoutes;

    routes.forEach((route) => {
      const { envSecret } = route;

      if (envSecret) {
        // TODO need to use env secret
      }

      const domainEndpointFn = this._getEndpointFnType(route, domain);

      httpApi.addRoutes({
        path: route.path,
        methods: [route.method],
        integration: new HttpLambdaIntegration(
          `${domain}${route.type}`,
          domainEndpointFn.function,
        ),
      });
    });
  }

  private _getEndpointFnType(
    route: IDomainEndpoint,
    domain: string,
    environment?: Record<string, string>,
  ) {
    const { entry, type } = route;
    const id = `${route.path}-${route.method}`;
    let domainEndpointFn;

    switch (type) {
      case "PUBLIC":
        domainEndpointFn = new FlexPublicFunction(this, id, {
          domain,
          entry: getEntry(domain, entry),
          environment,
        });
        break;
      case "PRIVATE":
        domainEndpointFn = new FlexPrivateEgressFunction(this, id, {
          domain,
          entry: getEntry(domain, entry),
          environment,
        });
        break;
      case "ISOLATED":
        domainEndpointFn = new FlexPrivateIsolatedFunction(this, id, {
          domain,
          entry: getEntry(domain, entry),
          environment,
        });
        break;
    }

    return domainEndpointFn;
  }
}
