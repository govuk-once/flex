import { Environment, getEnvConfig } from "@flex/utils";
import { Duration, Stack } from "aws-cdk-lib";
import { IRestApi } from "aws-cdk-lib/aws-apigateway";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  FunctionEventType,
  OriginRequestPolicy,
  PriceClass,
  SecurityPolicyProtocol,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { ARecord, IHostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import {
  BlockPublicAccess,
  Bucket,
  BucketAccessControl,
  ObjectLockMode,
  ObjectOwnership,
} from "aws-cdk-lib/aws-s3";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { CfnProtection } from "aws-cdk-lib/aws-shield";
import { CfnWebACL } from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";

import { applyCheckovSkip } from "../../utils/applyCheckovSkip";
import { getPlatformEntry } from "../../utils/getEntry";
import { CloudFrontAlarms } from "../alarms/cloudfront";
import { ShieldAlarms } from "../alarms/shield";
import { AlarmActionProps } from "../alarms/types";
import { WafAlarms } from "../alarms/waf";
import { FlexCloudfrontFunction } from "./flex-cloudfront-function";

const envConfig = getEnvConfig();

interface FlexCloudfrontProps extends AlarmActionProps {
  restApi: IRestApi;
  certArn: string;
  hostedZone: IHostedZone;
  domainName: string;
  subdomainName?: string;
  secretHeaderArn: string;
}

export class FlexCloudfront extends Construct {
  public readonly distribution: Distribution;
  public readonly e2eBypassSecret: Secret;

  constructor(
    scope: Construct,
    id: string,
    {
      restApi,
      certArn,
      domainName,
      subdomainName,
      hostedZone,
      criticalAction,
      warningAction,
      secretHeaderArn,
    }: FlexCloudfrontProps,
  ) {
    super(scope, id);

    const flexCloudfrontFunction = new FlexCloudfrontFunction(
      this,
      "ViewerRequestFunction",
      {
        functionSourcePath: getPlatformEntry(
          "viewer-request-cff",
          "handler.ts",
        ),
      },
    );

    const viewerRequestFunction = flexCloudfrontFunction.function;

    const cert = Certificate.fromCertificateArn(this, "flexDnsCert", certArn);

    this.e2eBypassSecret = new Secret(this, "E2EBypassSecret", {
      secretName: `/${envConfig.stage}/flex-secret/e2e-bypass`,
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 32,
      },
      replicaRegions: [{ region: "eu-west-2" }],
    });
    applyCheckovSkip(
      this.e2eBypassSecret,
      "CKV_AWS_149",
      "Using AWS managed keys is fine in this case and lets us keep the pattern consistent with origin-verify-secret",
    );

    const webAcl = new CfnWebACL(this, "CfWebAcl", {
      scope: "CLOUDFRONT",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "WebAcl",
        sampledRequestsEnabled: true,
      },
      dataProtectionConfig: {
        dataProtections: [
          {
            action: "SUBSTITUTION",
            field: {
              fieldType: "SINGLE_HEADER",
              fieldKeys: ["authorization"],
            },
            excludeRuleMatchDetails: false,
            excludeRateBasedDetails: false,
          },
        ],
      },
      rules: [
        {
          name: "AWSManagedRulesCommonRuleSet",
          priority: 0,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesCommonRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "AWSManagedRulesCommonRuleSet",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "AWSManagedRulesKnownBadInputsRuleSet",
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesKnownBadInputsRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "AWSManagedRulesKnownBadInputsRuleSet",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "BypassForE2ETests",
          priority: 2,
          action: { allow: {} },
          statement: {
            byteMatchStatement: {
              fieldToMatch: {
                singleHeader: { Name: "x-flex-e2e-bypass" },
              },
              positionalConstraint: "EXACTLY",
              searchString: this.e2eBypassSecret.secretValue.unsafeUnwrap(),
              textTransformations: [{ priority: 0, type: "NONE" }],
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "BypassForE2ETests",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "AWSManagedRulesAmazonIpReputationList",
          priority: 3,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesAmazonIpReputationList",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "AWSManagedRulesAmazonIpReputationList",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "RateLimit",
          priority: 4,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: "IP",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "RateLimit",
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    new WafAlarms(this, "CloudFrontWafAlarms", {
      alarmNamePrefix: `${envConfig.stage}-cf-waf`,
      criticalAction,
      warningAction,
      webAcl,
    });

    const accessLogBucket = new Bucket(this, "AccessLogBucket", {
      // NOSONAR enforceSSL is applied via the EnforceS3Https aspect
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
      lifecycleRules: [
        {
          id: "deleteLogsAfter12Months",
          expiration: Duration.days(365),
          noncurrentVersionExpiration: Duration.days(365),
        },
      ],
    });
    applyCheckovSkip(
      accessLogBucket,
      "CKV_AWS_18",
      "Log bucket intentionally does not log",
    );

    const originVerifySecret = Secret.fromSecretCompleteArn(
      this,
      "OriginVerifySecret",
      secretHeaderArn,
    );

    this.distribution = new Distribution(this, "Distribution", {
      comment: "Flex Platform CloudFront Distribution for Structural Checks",
      priceClass: PriceClass.PRICE_CLASS_100,
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      webAclId: webAcl.attrArn,
      defaultBehavior: {
        origin: new HttpOrigin(
          `${restApi.restApiId}.execute-api.eu-west-2.amazonaws.com`,
          {
            originPath: "/prod",
            customHeaders: {
              "x-origin-verify": originVerifySecret.secretValue.unsafeUnwrap(),
            },
          },
        ),
        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
        allowedMethods: AllowedMethods.ALLOW_ALL,
        cachePolicy: CachePolicy.CACHING_DISABLED,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        functionAssociations: [
          {
            function: viewerRequestFunction,
            eventType: FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      logBucket: accessLogBucket,
      publishAdditionalMetrics: true,
      domainNames: [subdomainName ?? domainName],
      certificate: cert,
    });

    new CloudFrontAlarms(this, "Alarms", {
      alarmNamePrefix: `${envConfig.stage}-cf`,
      distribution: this.distribution,
      viewerRequestFunction,
      criticalAction,
      warningAction,
    });

    // Shield Advanced is only enable in the production account currently so this
    // is required else deployments will fail in accounts that don't have it enabled
    if (envConfig.env === Environment.production) {
      const { account } = Stack.of(this);
      new CfnProtection(this, "ShieldProtection", {
        name: `${envConfig.stage}-flex-cloudfront`,
        resourceArn: `arn:aws:cloudfront::${account}:distribution/${this.distribution.distributionId}`,
      });

      new ShieldAlarms(this, "ShieldAlarms", {
        alarmNamePrefix: `${envConfig.stage}-shield`,
        resourceArn: this.distribution.distributionArn,
        criticalAction,
        warningAction,
      });
    }

    new ARecord(this, "DomainAliasRecord", {
      zone: hostedZone,
      recordName: subdomainName ? `${subdomainName}.` : undefined,
      target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
    });
  }
}
