import { HttpApi } from "aws-cdk-lib/aws-apigatewayv2";
import { Construct } from "constructs";

import { getPlatformEntry } from "../../utils/getEntry";
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
      {
        functionSourcePath: getPlatformEntry("fail-fast", "handler.ts"),
      },
    );

    this.distribution = new FlexCloudfrontDistribution(
      this,
      "CloudfrontDistribution",
      {
        cloudfrontFunction,
        httpApi,
      },
    );
  }
}
