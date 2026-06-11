import path from "node:path";

import { Environment, getEnvConfig } from "@flex/utils";
import { CfnOutput, Duration, RemovalPolicy } from "aws-cdk-lib";
import { IRestApi, RestApi } from "aws-cdk-lib/aws-apigateway";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
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
import { HttpOrigin, S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import {
  Code,
  Function as LambdaFunction,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
import {
  ARecord,
  HostedZone,
  IHostedZone,
  RecordTarget,
} from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
} from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { CfnProtection } from "aws-cdk-lib/aws-shield";
import { Topic } from "aws-cdk-lib/aws-sns";
import { LambdaSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import { CfnWebACL } from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";

import { BaseStack } from "../base";
import { importAlarmActions } from "../constructs/alarms/actions";
import { CloudFrontAlarms } from "../constructs/alarms/cloudfront";
import { ShieldAlarms } from "../constructs/alarms/shield";
import { AlarmActionProps } from "../constructs/alarms/types";
import { WafAlarms } from "../constructs/alarms/waf";
import { FlexCloudfrontFunction } from "../constructs/cloudfront/flex-cloudfront-function";
import { AccessLogBucket } from "../constructs/s3/AccessLogBucket";
import { ENV_KEYS, PLATFORM_KEYS, STAGE_KEYS } from "../ssm-keys";
import { applyCheckovSkip } from "../utils/applyCheckovSkip";
import { getPlatformEntry } from "../utils/getEntry";

interface DomainNames {
  domainName: string;
  subdomainName?: string;
}

const { env, persistent, stage } = getEnvConfig();

export class FlexGlobalStack extends BaseStack {
  #buildRelay(
    severity: "Critical" | "Warning",
    targetTopicArn: string,
    alarmTopicKey: Key,
  ) {
    const relayTopic = new Topic(this, `${severity}RelayTopic`, {
      masterKey: alarmTopicKey,
    });

    const relayFn = new LambdaFunction(this, `${severity}RelayFn`, {
      runtime: Runtime.NODEJS_24_X,
      handler: "index.handler",
      timeout: Duration.seconds(10),
      code: Code.fromInline(`
          const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
          const client = new SNSClient({ region: "eu-west-2" });
          exports.handler = async (event) => {
            for (const record of event.Records ?? []) {
              await client.send(new PublishCommand({
                TopicArn: ${targetTopicArn},
                Subject: record.Sns.Subject?.slice(0, 100),
                Message: record.Sns.Message,
                MessageAttributes: record.Sns.MessageAttributes,
              }));
            }
          };
        `),
    });

    relayFn.addToRolePolicy(
      new PolicyStatement({
        actions: ["sns:Publish"],
        resources: [targetTopicArn],
      }),
    );

    relayTopic.addSubscription(new LambdaSubscription(relayFn));

    return relayTopic;
  }

  #createAlarmActions() {
    const criticalTargetArn = this.import(
      ENV_KEYS.TopicCriticalAlarms,
      "eu-west-2",
    );
    const warningTargetArn = this.import(
      ENV_KEYS.TopicWarningAlarms,
      "eu-west-2",
    );

    const alarmTopicKey = new Key(this, "AlarmTopicRelayKey", {
      alias: `alias/${stage}-flex-alerts-relay-key`,
      description: "KMS key for alarm SNS topics",
      enableKeyRotation: true,
    });
    alarmTopicKey.grantEncryptDecrypt(
      new ServicePrincipal("cloudwatch.amazonaws.com"),
    );

    const criticalRelay = this.#buildRelay(
      "Critical",
      criticalTargetArn,
      alarmTopicKey,
    );
    const warningRelay = this.#buildRelay(
      "Warning",
      warningTargetArn,
      alarmTopicKey,
    );

    return importAlarmActions(this, {
      criticalTopicArn: criticalRelay.topicArn,
      warningTopicArn: warningRelay.topicArn,
    });
  }

  #getDomainName(): DomainNames {
    const domainName = this.import(PLATFORM_KEYS.HostedZoneName, "eu-west-2");
    const subdomainName = persistent ? undefined : `${stage}.${domainName}`;

    return { domainName, subdomainName };
  }

  #createCertificate({ domainName, subdomainName }: DomainNames) {
    const hostedZone = HostedZone.fromHostedZoneAttributes(this, "Zone", {
      hostedZoneId: this.import(PLATFORM_KEYS.HostedZoneId, "eu-west-2"),
      zoneName: this.import(PLATFORM_KEYS.HostedZoneName, "eu-west-2"),
    });

    const cert = new Certificate(this, "FlexCert", {
      domainName: subdomainName ?? domainName,
      validation: CertificateValidation.fromDns(hostedZone),
    });

    return { cert, hostedZone };
  }

  #getPublicRestApi() {
    const restApiId = this.import(STAGE_KEYS.ApigwPublicRestId, "eu-west-2");
    const rootResourceId = this.import(
      STAGE_KEYS.ApigwPublicAppRoot,
      "eu-west-2",
    );

    const restApi = RestApi.fromRestApiAttributes(this, "PublicRestApi", {
      restApiId,
      rootResourceId,
    });

    return { restApi };
  }

  #createCloudfrontWebAcl({ criticalAction, warningAction }: AlarmActionProps) {
    const e2eBypassSecret = new Secret(this, "E2EBypassSecret", {
      secretName: `/${stage}/flex-secret/e2e-bypass`,
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 32,
      },
      replicaRegions: [{ region: "eu-west-2" }],
    });
    applyCheckovSkip(
      e2eBypassSecret,
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
              searchString: e2eBypassSecret.secretValue.unsafeUnwrap(),
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
      alarmNamePrefix: `${stage}-cf-waf`,
      criticalAction,
      warningAction,
      webAcl,
    });

    return { e2eBypassSecret, webAcl };
  }

  #createCloudfrontDistribution({
    cert,
    criticalAction,
    domainName,
    openApiSpecBucket,
    restApi,
    secretHeaderArn,
    subdomainName,
    warningAction,
    webAcl,
  }: {
    cert: Certificate;
    domainName: string;
    openApiSpecBucket: Bucket;
    restApi: IRestApi;
    secretHeaderArn: string;
    subdomainName?: string;
    webAcl: CfnWebACL;
  } & AlarmActionProps) {
    const { function: viewerRequestFunction } = new FlexCloudfrontFunction(
      this,
      "ViewerRequestFunction",
      {
        functionSourcePath: getPlatformEntry(
          "viewer-request-cff",
          "handler.ts",
        ),
      },
    );

    const accessLogBucket = new AccessLogBucket(
      this,
      "CloudfrontAccessLogBucket",
    );

    const originVerifySecret = Secret.fromSecretCompleteArn(
      this,
      "OriginVerifySecret",
      secretHeaderArn,
    );

    const distribution = new Distribution(this, "Distribution", {
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
      additionalBehaviors: {
        "/docs*": {
          origin: S3BucketOrigin.withOriginAccessControl(openApiSpecBucket),
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        },
      },
      logBucket: accessLogBucket.bucket,
      publishAdditionalMetrics: true,
      domainNames: [subdomainName ?? domainName],
      certificate: cert,
    });

    new CloudFrontAlarms(this, "Alarms", {
      alarmNamePrefix: `${stage}-cf`,
      distribution,
      viewerRequestFunction,
      criticalAction,
      warningAction,
    });

    return distribution;
  }

  #createCloudfrontShield({
    distribution,
    criticalAction,
    warningAction,
  }: {
    distribution: Distribution;
  } & AlarmActionProps) {
    // Shield Advanced is only enable in the production account currently so this
    // is required else deployments will fail in accounts that don't have it enabled
    if (env === Environment.production) {
      new CfnProtection(this, "ShieldProtection", {
        name: `${stage}-flex-cloudfront`,
        resourceArn: `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
      });

      new ShieldAlarms(this, "ShieldAlarms", {
        alarmNamePrefix: `${stage}-shield`,
        resourceArn: distribution.distributionArn,
        criticalAction,
        warningAction,
      });
    }
  }

  #createARecord({
    distribution,
    hostedZone,
    subdomainName,
  }: {
    distribution: Distribution;
    hostedZone: IHostedZone;
    subdomainName?: string;
  }) {
    new ARecord(this, "DomainAliasRecord", {
      zone: hostedZone,
      recordName: subdomainName ? `${subdomainName}.` : undefined,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });
  }

  #createOpenApiSpecBucket() {
    const accessLogBucket = new AccessLogBucket(
      this,
      "OpenApiSpecAccessLogBucket",
    );

    return new Bucket(this, "OpenApiSpecsBucket", {
      // NOSONAR enforceSSL is applied via the EnforceS3Https aspect
      bucketName: `flex-${stage}-openapi-specs`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: true,
      lifecycleRules: [
        {
          prefix: "docs/specs/",
          noncurrentVersionExpiration: Duration.days(30),
        },
      ],
      serverAccessLogsBucket: accessLogBucket.bucket,
    });
  }

  #deploySwaggerUi({
    bucket,
    distribution,
  }: {
    bucket: Bucket;
    distribution: Distribution;
  }) {
    const deployment = new BucketDeployment(this, "DocsUi", {
      sources: [Source.asset(path.join(import.meta.dirname, "../docs"))],
      destinationBucket: bucket,
      destinationKeyPrefix: "docs/",
      // False to maintain the generated doc files
      prune: false,
      distribution,
      distributionPaths: ["/docs/index.html"],
    });
    applyCheckovSkip(
      deployment.handlerRole.node.findChild("DefaultPolicy"),
      "CKV_AWS_111",
      "CDK BucketDeployment grants cloudfront:CreateInvalidation on * by design; the construct does not support scoping.",
    );
  }

  constructor(scope: Construct, id: string) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "N/A",
        ResourceOwner: "flex-platform",
        Source: "https://github.com/govuk-once/flex",
      },
      env: {
        region: "us-east-1",
      },
    });

    const { domainName, subdomainName } = this.#getDomainName();

    const { cert, hostedZone } = this.#createCertificate({
      domainName,
      subdomainName,
    });

    const { criticalAction, warningAction } = this.#createAlarmActions();

    const { restApi } = this.#getPublicRestApi();

    const { e2eBypassSecret, webAcl } = this.#createCloudfrontWebAcl({
      criticalAction,
      warningAction,
    });

    const secretHeaderArn = this.import(
      STAGE_KEYS.WafCfSecretHeaderArn,
      "eu-west-2",
    );

    const openApiSpecBucket = this.#createOpenApiSpecBucket();

    const distribution = this.#createCloudfrontDistribution({
      cert,
      criticalAction,
      domainName,
      openApiSpecBucket,
      restApi,
      secretHeaderArn,
      subdomainName,
      warningAction,
      webAcl,
    });

    this.#deploySwaggerUi({ bucket: openApiSpecBucket, distribution });

    this.#createARecord({ distribution, hostedZone, subdomainName });

    this.#createCloudfrontShield({
      distribution,
      criticalAction,
      warningAction,
    });

    new CfnOutput(this, "FlexApiUrl", {
      value: `https://${subdomainName ?? domainName}`,
    });

    new CfnOutput(this, "E2EBypassSecretArn", {
      value: e2eBypassSecret.secretArn,
    });
  }
}
