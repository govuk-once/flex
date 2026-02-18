import { IDomain, IDomainRoutes } from "@flex/sdk";
import { GovUkOnceStack } from "@platform/gov-uk-once";
import { IResource } from "aws-cdk-lib/aws-apigateway";
import { HttpApi, HttpRoute, HttpRouteKey } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type { Construct } from "constructs";

import { processDomainRoutes } from "../utils/processDomainRoutes";

interface FlexDomainStackProps {
  domain: IDomain;
  httpApi: HttpApi;
  domainsResource: IResource;
}

export class FlexDomainStack extends GovUkOnceStack {
  domain: string;
  #httpApi: HttpApi;
  #domainsResource: IResource;

  constructor(
    scope: Construct,
    id: string,
    {
      domain: { domain, owner },
      httpApi,
      domainsResource,
    }: FlexDomainStackProps,
  ) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: owner ?? "N/A",
        ResourceOwner: domain,
        Source: "https://github.com/govuk-once/flex",
      },
    });
    this.domain = domain;
    this.#httpApi = httpApi;
    this.#domainsResource = domainsResource;
  }

  processRoutes(versionedRoutes: IDomainRoutes) {
    processDomainRoutes(this, {
      domain: this.domain,
      versionedRoutes,
      domainsResource: this.#domainsResource,
      createApiRoute: (domain, version, path, method, handler) => {
        const fullPath = `/app/${version}${path}`.replace(/\/\//g, "/");
        const cleanPathId = path.replace(/\//g, "");
        const integrationId = `${domain}-${version}-${method}-${cleanPathId}`;

        new HttpRoute(this, `Route-${integrationId}`, {
          httpApi: this.#httpApi,
          routeKey: HttpRouteKey.with(fullPath, method),
          integration: new HttpLambdaIntegration(integrationId, handler),
        });
      },
    });
  }
}
