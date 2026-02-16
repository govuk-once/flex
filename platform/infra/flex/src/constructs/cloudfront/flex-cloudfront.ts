import { Duration, Fn, Stack } from "aws-cdk-lib";
import { HttpApi } from "aws-cdk-lib/aws-apigatewayv2";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  FunctionEventType,
  OriginProtocolPolicy,
  OriginRequestPolicy,
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
  ObjectLockMode,
  ObjectOwnership,
} from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

import { applyCheckovSkip } from "../../utils/applyCheckovSkip";
import { getPlatformEntry } from "../../utils/getEntry";
import { FlexCloudfrontFunction } from "./flex-cloudfront-function";

interface FlexCloudfrontProps {
  httpApi: HttpApi;
  certArn: string;
  domainName: string;
  subdomainName?: string;
}

export class FlexCloudfront extends Construct {
  public readonly distribution: Distribution;

  constructor(
    scope: Construct,
    id: string,
    { httpApi, certArn, domainName, subdomainName }: FlexCloudfrontProps,
  ) {
    super(scope, id);

    const failFastFunction = new FlexCloudfrontFunction(
      this,
      "CloudfrontFunction",
      {
        functionSourcePath: getPlatformEntry("fail-fast", "handler.ts"),
      },
    );

    const cert = Certificate.fromCertificateArn(this, "flexDnsCert", certArn);

    const accessLogBucket = new Bucket(this, "AccessLogBucket", {
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.OBJECT_WRITER,
      accessControl: BucketAccessControl.LOG_DELIVERY_WRITE,
      versioned: true,
      objectLockEnabled: true,
      objectLockDefaultRetention: {
        mode: ObjectLockMode.GOVERNANCE,
        duration: Duration.days(365),
      },
    });
    applyCheckovSkip(
      accessLogBucket,
      "CKV_AWS_18",
      "Archive bucket intentionally doesn't log to avoid circular dependency",
    );

    const stack = Stack.of(this);
    const apiDomainName = Fn.join(".", [
      httpApi.apiId,
      "execute-api",
      stack.region,
      "amazonaws.com",
    ]);

    this.distribution = new Distribution(this, "Distribution", {
      comment: "Flex Platform CloudFront Distribution for Structural Checks",
      priceClass: PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: new HttpOrigin(apiDomainName, {
          protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
          originPath: "",
        }),
        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
        allowedMethods: AllowedMethods.ALLOW_ALL,
        cachePolicy: CachePolicy.CACHING_DISABLED,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        functionAssociations: [
          {
            function: failFastFunction.function,
            eventType: FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      logBucket: accessLogBucket,
      domainNames: [subdomainName ?? domainName],
      certificate: cert,
    });

    const zone = HostedZone.fromLookup(this, "HostedZone", { domainName });

    new ARecord(this, "DomainAliasRecord", {
      zone,
      recordName: subdomainName ? `${subdomainName}.` : undefined,
      target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
    });
  }
}
