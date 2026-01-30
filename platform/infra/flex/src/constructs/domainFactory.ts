import { IDomainEndpoint, IRoutes } from "@flex/iac";
import { NestedStack } from "aws-cdk-lib";
import { HttpApi } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";

import { getEntry } from "../utils/getEntry";
import { FlexPrivateEgressFunction } from "./lambda/flex-private-egress-function";
import { FlexPrivateIsolatedFunction } from "./lambda/flex-private-isolated-function";
import { FlexPublicFunction } from "./lambda/flex-public-function";

// Using NestedStack but would we want this to be its own stack perhaps?
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
      const domainEndpointFn = this.getEndpointFnType(route, domain);

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

  /**
   * PRIVATE ~ helper functions
   */
  private getEndpointFnType(route: IDomainEndpoint, domain: string) {
    const { entry, type } = route;
    let domainEndpointFn;

    // TODO update from "public", "private", etc for the fn class
    switch (type) {
      case "PUBLIC":
        domainEndpointFn = new FlexPublicFunction(this, "public", {
          domain,
          entry: getEntry(domain, entry),
        });
        break;
      case "PRIVATE":
        domainEndpointFn = new FlexPrivateEgressFunction(this, "private", {
          domain,
          entry: getEntry(domain, entry),
        });
        break;
      case "ISOLATED":
        domainEndpointFn = new FlexPrivateIsolatedFunction(this, "isolated", {
          domain,
          entry: getEntry(domain, entry),
        });
        break;
    }

    return domainEndpointFn;
  }
}
