import { GovUkOnceStack } from "@platform/gov-uk-once";
import { CfnOutput } from "aws-cdk-lib";
import { HttpApi } from "aws-cdk-lib/aws-apigatewayv2";
import type { Construct } from "constructs";

import { FlexHttpApi } from "../constructs/api-gateway/flex-http-api";
import { FlexCloudfront } from "../constructs/cloudfront/flex-cloudfront";

interface FlexPlatformStackProps {
  certArn: string;
  domainName: string;
  subdomainName?: string;
}

export class FlexPlatformStack extends GovUkOnceStack {
  public readonly httpApi: HttpApi;

  constructor(
    scope: Construct,
    id: string,
    { certArn, domainName, subdomainName }: FlexPlatformStackProps,
  ) {
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
    this.httpApi = httpApi;

    new FlexCloudfront(this, "Cloudfront", {
      certArn,
      domainName,
      subdomainName,
      httpApi,
    });

    new CfnOutput(this, "FlexApiUrl", {
      value: `https://${subdomainName ?? domainName}`,
    });
  }
}
