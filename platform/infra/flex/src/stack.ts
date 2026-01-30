import { IRoutes } from "@flex/iac";
import { GovUkOnceStack } from "@platform/gov-uk-once";
import { CfnOutput } from "aws-cdk-lib";
import type { Construct } from "constructs";

import { FlexHttpApi } from "./constructs/apiGateway/flex-http-api";
import { FlexFailFast } from "./constructs/cloudfront/flex-fail-fast";
import { domainFactory } from "./constructs/domainFactory";

export class FlexPlatformStack extends GovUkOnceStack {
  constructor(scope: Construct, id: string, domains: IRoutes[]) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "N/A",
        ResourceOwner: "flex-platform",
        Source: "https://github.com/govuk-once/flex",
      },
    });

    const { httpApi, httpApiUrl } = new FlexHttpApi(this, "HttpApi");
    const { distribution } = new FlexFailFast(this, "FailFast", httpApi);

    domains.forEach((domain) => {
      new domainFactory(this, `${domain.domain}Domain`, domain, httpApi);
    });

    new CfnOutput(this, "HttpApiUrl", { value: httpApiUrl });
    new CfnOutput(this, "CloudfrontDistributionUrl", {
      value: `https://${distribution.distribution.distributionDomainName}`,
    });
  }
}
