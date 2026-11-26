import { Duration, Stack } from "aws-cdk-lib";
import { Effect, PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  ObjectLockRetention,
  ObjectOwnership,
} from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

import { applyCheckovSkip } from "../../utils/applyCheckovSkip";

const WAF_LOG_BUCKET_NAME_PREFIX = "aws-waf-logs-";

export interface WafLogBucketProps {
  readonly bucketNameSuffix: string;
  readonly retentionDays?: number;
}

export class WafLogBucket extends Construct {
  public readonly bucket: Bucket;

  constructor(
    scope: Construct,
    id: string,
    { bucketNameSuffix, retentionDays = 90 }: WafLogBucketProps,
  ) {
    super(scope, id);

    const { account, partition, region } = Stack.of(this);
    const retention = Duration.days(retentionDays);

    this.bucket = new Bucket(this, "WafLogBucket", {
      bucketName: `${WAF_LOG_BUCKET_NAME_PREFIX}${bucketNameSuffix}`,
      enforceSSL: true,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: BucketEncryption.S3_MANAGED,
      versioned: true,
      objectLockEnabled: true,
      objectLockDefaultRetention: ObjectLockRetention.governance(retention),
      lifecycleRules: [
        {
          id: "expireLogs",
          expiration: retention,
          noncurrentVersionExpiration: retention,
        },
      ],
    });

    const logDeliveryPrincipal = new ServicePrincipal(
      "delivery.logs.amazonaws.com",
    );
    const sourceAccountCondition = { "aws:SourceAccount": account };
    const sourceArnCondition = {
      "aws:SourceArn": `arn:${partition}:logs:${region}:${account}:*`,
    };

    this.bucket.addToResourcePolicy(
      new PolicyStatement({
        sid: "AWSLogDeliveryWrite",
        effect: Effect.ALLOW,
        principals: [logDeliveryPrincipal],
        actions: ["s3:PutObject"],
        resources: [this.bucket.arnForObjects(`AWSLogs/${account}/*`)],
        conditions: {
          StringEquals: {
            ...sourceAccountCondition,
            "s3:x-amz-acl": "bucket-owner-full-control",
          },
          ArnLike: sourceArnCondition,
        },
      }),
    );
    this.bucket.addToResourcePolicy(
      new PolicyStatement({
        sid: "AWSLogDeliveryAclCheck",
        effect: Effect.ALLOW,
        principals: [logDeliveryPrincipal],
        actions: ["s3:GetBucketAcl"],
        resources: [this.bucket.bucketArn],
        conditions: {
          StringEquals: sourceAccountCondition,
          ArnLike: sourceArnCondition,
        },
      }),
    );

    applyCheckovSkip(
      this.bucket,
      "CKV_AWS_18",
      "Log bucket intentionally does not log",
    );
  }
}
