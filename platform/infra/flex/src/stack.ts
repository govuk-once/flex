import { GovUkOnceStack } from "@platform/gov-uk-once";
import { CfnOutput } from "aws-cdk-lib";
import { HttpApi } from "aws-cdk-lib/aws-apigatewayv2";
import type { Construct } from "constructs";

import { FlexHttpApi } from "./constructs/apiGateway/flex-http-api";
import { FlexFailFast } from "./constructs/cloudfront/flex-fail-fast";

export interface IDomainConfig {
  certArn: string;
  domainName: string;
  prefix?: string;
}

interface IFlexPlatformStack {
  domainConfig: IDomainConfig;
}

export class FlexPlatformStack extends GovUkOnceStack {
  public readonly httpApi: HttpApi;

  constructor(scope: Construct, id: string, props: IFlexPlatformStack) {
    const { domainConfig } = props;
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "N/A",
        ResourceOwner: "flex-platform",
        Source: "https://github.com/govuk-once/flex",
      },
      crossRegionReferences: true,
    });

    const { httpApi } = new FlexHttpApi(this, "HttpApi");
    const { distribution } = new FlexFailFast(
      this,
      "FailFast",
      httpApi,
      domainConfig,
    );

    this.httpApi = httpApi;

    new CfnOutput(this, "CloudfrontDistributionUrl", {
      value: `https://${distribution.distribution.distributionDomainName}`,
    });
  }
}
