import { IRoutes } from "@flex/iac";
import { GovUkOnceStack } from "@platform/gov-uk-once";
import { CfnOutput } from "aws-cdk-lib";
import type { Construct } from "constructs";

import { FlexHttpApi } from "./constructs/apiGateway/flex-http-api";
// import { RouteGroup } from "./constructs/apiGateway/flex-route-group";
import { FlexFailFast } from "./constructs/cloudfront/flex-fail-fast";
import { domainFactory } from "./constructs/domainFactory";
// import { UdpDomain } from "./constructs/udp";

export class FlexPlatformStack extends GovUkOnceStack {
  constructor(scope: Construct, id: string, domains: IRoutes[]) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "",
        ResourceOwner: "flex-platform",
        Source: "https://github.com/govuk-once/flex",
      },
    });

    const { httpApi, httpApiUrl } = new FlexHttpApi(this, "HttpApi");
    const { distribution } = new FlexFailFast(this, "FailFast", httpApi);

    /**
     * TODO:
     * - Get the domainFactory working first with the hello domain
     * - Need to get the version to get created via the domain loop
     *   - Think with will need to be in the domainFactory class though
     * - Need to add the UdpDomain insot the domainFactory
     */
    domains.forEach((domain) => {
      new domainFactory(this, `${domain.domain}Domain`, domain, httpApi);
    });

    // UDP stuff needs updating to be encapulated within the above
    // const v1 = new RouteGroup(this, "V1", {
    //   httpApi,
    //   pathPrefix: "/1.0/app",
    // });
    // new UdpDomain(this, "UdpDomain", v1);

    new CfnOutput(this, "HttpApiUrl", { value: httpApiUrl });
    new CfnOutput(this, "CloudfrontDistributionUrl", {
      value: `https://${distribution.distribution.distributionDomainName}`,
    });
  }
}
