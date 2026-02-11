import { IDomainConfig } from "@flex/sdk";
import { GovUkOnceStack } from "@platform/gov-uk-once";
import { HttpApi } from "aws-cdk-lib/aws-apigatewayv2";
import type { Construct } from "constructs";

import { DomainFactory } from "./constructs/domainFactory";

export class FlexDomainStack extends GovUkOnceStack {
  public readonly domainFactory: DomainFactory;

  constructor(
    scope: Construct,
    id: string,
    domainProps: IDomainConfig,
    httpApi: HttpApi,
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

    this.domainFactory = new DomainFactory(
      this,
      `${domainProps.domain}Domain`,
      domainProps.domain,
      httpApi,
    );
    if (domainProps.public) {
      this.domainFactory.processRoutes(domainProps.public);
    }
  }
}
