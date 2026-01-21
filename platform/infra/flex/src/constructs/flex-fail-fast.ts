import { HttpApi } from "aws-cdk-lib/aws-apigatewayv2";
import { Construct } from "constructs";

import { FlexCloudfrontDistribution } from "./flex-cloudfront-distribution";
import { FlexCloudfrontFunction } from "./flex-cloudfront-function";

export class FlexFailFast extends Construct {
  public readonly distribution: FlexCloudfrontDistribution;

  constructor(scope: Construct, id: string, httpApi: HttpApi) {
    super(scope, id);
    // CloudFront distribution and function for Structural Checks
    const cloudfrontFunction = new FlexCloudfrontFunction(
      this,
      "CloudfrontFunction",
    );

    this.distribution = new FlexCloudfrontDistribution(
      this,
      "CloudfrontDistribution",
      {
        cloudfrontFunction,
        httpApiUrl: httpApi.url!,
        httpApi,
      },
    );
  }
}
