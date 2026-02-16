import { randomBytes } from "node:crypto";

import { getEnvConfig } from "@platform/gov-uk-once";
import { Duration, Stack } from "aws-cdk-lib";
import { RestApi } from "aws-cdk-lib/aws-apigateway";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  FunctionEventType,
  OriginRequestPolicy,
  PriceClass,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { RestApiOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import {
  BlockPublicAccess,
  Bucket,
  BucketAccessControl,
  ObjectLockMode,
  ObjectOwnership,
} from "aws-cdk-lib/aws-s3";
import { CfnWebACL, CfnWebACLAssociation } from "aws-cdk-lib/aws-wafv2";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";

import { applyCheckovSkip } from "../../utils/applyCheckovSkip";
import { getPlatformEntry } from "../../utils/getEntry";
import { FlexCloudfrontFunction } from "./flex-cloudfront-function";

const envConfig = getEnvConfig();

interface FlexCloudfrontProps {
  restApi: RestApi;
  certArn: string;
  domainName: string;
  subdomainName?: string;
}

export class FlexCloudfront extends Construct {
  public readonly distribution: Distribution;

  /**
   * To prevent any down time we return the previous secret and a new one that will be stored.
   * This means cloudfront can send the old secret and still be accepted. This will mitigate
   * any propogation issues when updating the header in cloudfront
   *
   * @returns {{ currentSecret: String, previousSecret: String }} A pair of secrets to accept in the WAF
   */
  #createRotatingSecret(): {
    setCurrentSecret: AwsCustomResource;
    currentSecret: string;
    previousSecret: string;
  } {
    const stack = Stack.of(this);

    const paramName = `/${envConfig.stage}/flex/secure-api/origin-secret`;
    const paramArn = `arn:aws:ssm:${stack.region}:${stack.account}:parameter${paramName}`;
    const newSecret = randomBytes(64).toString("hex");

    // Ensure the parameter exists with a default value. This is important on the first
    // deployment for ephemeral envs. Likely will only run once on the main envs.
    const seedSecretResource = new AwsCustomResource(this, "SeedSecret", {
      onCreate: {
        service: "SSM",
        action: "putParameter",
        parameters: { Name: paramName, Value: newSecret, Type: "String" },
        physicalResourceId: PhysicalResourceId.of("seed-secret"),
        ignoreErrorCodesMatching: "ParameterAlreadyExists",
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({ resources: [paramArn] }),
    });

    // Safe to read as it will have been created above if it did not exist
    const previousSecret = new AwsCustomResource(this, "GetPreviousSecret", {
      onCreate: {
        service: "SSM",
        action: "getParameter",
        parameters: { Name: paramName },
        physicalResourceId: PhysicalResourceId.of("get-previous-secret"),
      },
      onUpdate: {
        service: "SSM",
        action: "getParameter",
        parameters: { Name: paramName },
        physicalResourceId: PhysicalResourceId.of("get-previous-secret"),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({ resources: [paramArn] }),
    });

    previousSecret.node.addDependency(seedSecretResource);

    // Store the new secret for the next deployment
    const setCurrentSecret = new AwsCustomResource(this, "StoreNewSecret", {
      onCreate: {
        service: "SSM",
        action: "putParameter",
        parameters: {
          Name: paramName,
          Value: newSecret,
          Type: "String",
          Overwrite: true,
        },
        physicalResourceId: PhysicalResourceId.of("store-new-secret"),
      },
      onUpdate: {
        service: "SSM",
        action: "putParameter",
        parameters: {
          Name: paramName,
          Value: newSecret,
          Type: "String",
          Overwrite: true,
        },
        physicalResourceId: PhysicalResourceId.of("store-new-secret"),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({ resources: [paramArn] }),
    });

    setCurrentSecret.node.addDependency(previousSecret);

    return {
      setCurrentSecret,
      currentSecret: newSecret,
      // The previous secret, falling back to newSecret on first deploy
      previousSecret:
        previousSecret.getResponseField("Parameter.Value") || newSecret,
    };
  }

  #headerMatchStatement(secret: string) {
    return {
      byteMatchStatement: {
        fieldToMatch: {
          singleHeader: { name: "x-origin-verify" },
        },
        positionalConstraint: "EXACTLY",
        searchString: secret,
        textTransformations: [{ priority: 0, type: "NONE" }],
      },
    };
  }

  constructor(
    scope: Construct,
    id: string,
    { restApi, certArn, domainName, subdomainName }: FlexCloudfrontProps,
  ) {
    super(scope, id);

    const { setCurrentSecret, currentSecret, previousSecret } =
      this.#createRotatingSecret();

    const viwerRequestFunction = new FlexCloudfrontFunction(
      this,
      "ViewerRequestFunction",
      {
        functionSourcePath: getPlatformEntry(
          "viewer-request-cff",
          "handler.ts",
        ),
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

    this.distribution = new Distribution(this, "Distribution", {
      comment: "Flex Platform CloudFront Distribution for Structural Checks",
      priceClass: PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: new RestApiOrigin(restApi, {
          originPath: "/prod",
          customHeaders: {
            "x-origin-verify": currentSecret,
          },
        }),
        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
        allowedMethods: AllowedMethods.ALLOW_ALL,
        cachePolicy: CachePolicy.CACHING_DISABLED,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        functionAssociations: [
          {
            function: viwerRequestFunction.function,
            eventType: FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      logBucket: accessLogBucket,
      domainNames: [subdomainName ?? domainName],
      certificate: cert,
    });

    setCurrentSecret.node.addDependency(this.distribution);

    const webAcl = new CfnWebACL(this, "ApiWaf", {
      scope: "REGIONAL",
      defaultAction: {
        block: {},
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: "OriginVerifyWebAcl",
      },
      rules: [
        {
          name: "RequireOriginSecret",
          priority: 0,
          visibilityConfig: {
            cloudWatchMetricsEnabled: false,
            sampledRequestsEnabled: false,
            metricName: "RequireOriginSecret",
          },
          action: {
            allow: {},
          },
          statement: {
            orStatement: {
              statements: [
                this.#headerMatchStatement(currentSecret),
                this.#headerMatchStatement(previousSecret),
              ],
            },
          },
        },
        {
          name: "AWSManagedRulesKnownBadInputsRuleSet",
          priority: 1,
          visibilityConfig: {
            cloudWatchMetricsEnabled: false,
            sampledRequestsEnabled: false,
            metricName: "AWSManagedRulesKnownBadInputsRuleSet",
          },
          overrideAction: {
            none: {},
          },
          statement: {
            managedRuleGroupStatement: {
              name: "AWSManagedRulesKnownBadInputsRuleSet",
              vendorName: "AWS",
            },
          },
        },
      ],
    });

    new CfnWebACLAssociation(this, "WebAclAssociation", {
      webAclArn: webAcl.attrArn,
      resourceArn: restApi.deploymentStage.stageArn,
    });

    const zone = HostedZone.fromLookup(this, "HostedZone", { domainName });

    new ARecord(this, "DomainAliasRecord", {
      zone,
      recordName: subdomainName ? `${subdomainName}.` : undefined,
      target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
    });
  }
}
