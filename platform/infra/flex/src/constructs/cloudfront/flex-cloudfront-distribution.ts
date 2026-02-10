import * as cdk from "aws-cdk-lib";
import type { HttpApi } from "aws-cdk-lib/aws-apigatewayv2";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import {
  AllowedMethods,
  Distribution,
  FunctionEventType,
  OriginProtocolPolicy,
  PriceClass,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import {
  BlockPublicAccess,
  Bucket,
  BucketAccessControl,
  CfnBucket,
  ObjectOwnership,
} from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

import { IDomainConfig } from "../../stack";
import { FlexCloudfrontFunction } from "./flex-cloudfront-function";

export interface FlexCloudfrontDistributionProps {
  cloudfrontFunction: FlexCloudfrontFunction;
  httpApi: HttpApi;
  domainConfig: IDomainConfig;
}

export class FlexCloudfrontDistribution extends Construct {
  public readonly distribution: Distribution;

  constructor(
    scope: Construct,
    id: string,
    props: FlexCloudfrontDistributionProps,
  ) {
    super(scope, id);

    const { domainConfig } = props;

    const cert = Certificate.fromCertificateArn(
      this,
      "flexDnsCert",
      domainConfig.certArn,
    );

    // required for CKV_AWS_18 - all s3 buckets should have logging enabled
    const accessLogArchiveBucket = new Bucket(this, "AccessLogArchiveBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      versioned: true,
    });

    const cfnBucket = accessLogArchiveBucket.node.defaultChild as CfnBucket;

    cfnBucket.cfnOptions.metadata = {
      checkov: {
        skip: [
          {
            id: "CKV_AWS_18",
            comment:
              "Archive bucket intentionally doesn't log to avoid circular dependency",
          },
        ],
      },
    };

    // required for CKV_AWS_86 all cloudfront distributions should have logging enabled
    const accessLogBucket = new Bucket(this, "AccessLogBucket", {
      publicReadAccess: false,
      versioned: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.OBJECT_WRITER,
      accessControl: BucketAccessControl.LOG_DELIVERY_WRITE,
      serverAccessLogsBucket: accessLogArchiveBucket,
      serverAccessLogsPrefix: "cloudfront-access/",
    });

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
      logBucket: accessLogBucket,
      domainNames: domainConfig.prefix
        ? [`${domainConfig.prefix}.${domainConfig.domainName}`]
        : [domainConfig.domainName],
      certificate: cert,
    });

    const zone = HostedZone.fromLookup(this, "HostedZone", {
      domainName: domainConfig.domainName,
    });

    new ARecord(this, "domainAliasRecord", {
      zone,
      recordName: domainConfig.prefix ? domainConfig.prefix : undefined,
      target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
    });

    // TLS1.2+ is the default for CloudFront distributions
    const cfnDistribution = this.distribution.node
      .defaultChild as cdk.aws_cloudfront.CfnDistribution;
    cfnDistribution.cfnOptions.metadata = {
      checkov: {
        skip: [
          {
            id: "CKV_AWS_174",
          },
        ],
      },
    };
  }
}
