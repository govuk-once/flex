import { IDomainConfig } from "@flex/sdk";
import { GovUkOnceStack } from "@platform/gov-uk-once";
import { IResource } from "aws-cdk-lib/aws-apigateway";
import { HttpApi } from "aws-cdk-lib/aws-apigatewayv2";
import type { Construct } from "constructs";

import { DomainFactory } from "./constructs/domainFactory";
import { PrivateDomainFactory } from "./constructs/privateDomainFactory";

export class FlexPrivateDomainStack extends GovUkOnceStack {
  public readonly domainFactory: DomainFactory;

  constructor(
    scope: Construct,
    id: string,
    domainProps: IDomainConfig,
    httpApi: HttpApi,
    domainsResource: IResource,
  ) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: domainProps.owner ?? "N/A",
        ResourceOwner: domainProps.domain,
        Source: "https://github.com/govuk-once/flex",
      },
    });

    this.domainFactory = new PrivateDomainFactory(
      this,
      `${domainProps.domain}PrivateDomain`,
      domainProps.domain,
      httpApi,
      domainsResource,
    );

    if (domainProps.private) {
      this.domainFactory.processRoutes(domainProps.private);
    }
  }
}
