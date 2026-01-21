import * as cdk from "aws-cdk-lib";
import type { HttpApi } from "aws-cdk-lib/aws-apigatewayv2";
import {
  AllowedMethods,
  Distribution,
  FunctionEventType,
  OriginProtocolPolicy,
  PriceClass,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Construct } from "constructs";

import { FlexCloudfrontFunction } from "./flex-cloudfront-function";

export interface FlexCloudfrontDistributionProps {
  cloudfrontFunction: FlexCloudfrontFunction;
  httpApi: HttpApi;
  httpApiUrl: string;
}

export class FlexCloudfrontDistribution extends Construct {
  public readonly distribution: Distribution;

  constructor(
    scope: Construct,
    id: string,
    props: FlexCloudfrontDistributionProps,
  ) {
    super(scope, id);

    // Construct API Gateway domain name from HttpApi object
    // Domain format: {api-id}.execute-api.{region}.amazonaws.com
    // We use CDK tokens here since apiId and region are resolved at deployment time
    const stack = cdk.Stack.of(this);
    const apiDomainName = cdk.Fn.join(".", [
      props.httpApi.apiId,
      "execute-api",
      stack.region,
      "amazonaws.com",
    ]);

    this.distribution = new Distribution(this, "Distribution", {
      comment: "Flex Platform CloudFront Distribution for Structural Checks",
      priceClass: PriceClass.PRICE_CLASS_100, // Cheapest option (EU/US only)
      defaultBehavior: {
        origin: new HttpOrigin(apiDomainName, {
          // API Gateway uses HTTPS
          protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
          // Preserve the original host header so API Gateway can route correctly
          originPath: "",
        }),
        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
        // Allow all HTTP methods since API Gateway supports them
        allowedMethods: AllowedMethods.ALLOW_ALL,
        // Forward all headers to preserve API Gateway functionality
        cachePolicy: cdk.aws_cloudfront.CachePolicy.CACHING_DISABLED,
        // Forward query strings and cookies for API Gateway
        originRequestPolicy:
          cdk.aws_cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        functionAssociations: [
          {
            function: props.cloudfrontFunction.function,
            eventType: FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      // Enable logging for debugging (optional)
      enableLogging: false,
    });
  }
}
