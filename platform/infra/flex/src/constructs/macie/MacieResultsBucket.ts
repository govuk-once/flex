import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Effect, PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  ObjectOwnership,
} from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

import { applyCheckovSkip } from "../../utils/applyCheckovSkip";

export class MacieResultsBucket extends Construct {
  public readonly bucket: Bucket;
  public readonly key: Key;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const { account, region, partition } = Stack.of(this);

    const maciePrincipal = new ServicePrincipal("macie.amazonaws.com");
    const sourceArns = [
      `arn:${partition}:macie2:${region}:${account}:export-configuration:*`,
      `arn:${partition}:macie2:${region}:${account}:classification-job/*`,
    ];
    const macieSourceConditions = {
      StringEquals: { "aws:SourceAccount": account },
      ArnLike: { "aws:SourceArn": sourceArns },
    };

    this.key = new Key(this, "Key", {
      alias: "alias/flex-macie-results-key",
      description: "Encrypts Macie sensitive data discovery results",
      enableKeyRotation: true,
    });
    this.key.addToResourcePolicy(
      new PolicyStatement({
        sid: "AllowMacieToEncryptResults",
        effect: Effect.ALLOW,
        principals: [maciePrincipal],
        actions: ["kms:GenerateDataKey", "kms:Encrypt"],
        resources: ["*"],
        conditions: macieSourceConditions,
      }),
    );

    const accessLogBucket = new Bucket(this, "AccessLogBucket", {
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: "expireLogs",
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

    this.bucket = new Bucket(this, "Bucket", {
      encryption: BucketEncryption.KMS,
      encryptionKey: this.key,
      bucketKeyEnabled: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      serverAccessLogsBucket: accessLogBucket,
    });

    this.bucket.addToResourcePolicy(
      new PolicyStatement({
        sid: "AllowMacieGetBucketLocation",
        effect: Effect.ALLOW,
        principals: [maciePrincipal],
        actions: ["s3:GetBucketLocation"],
        resources: [this.bucket.bucketArn],
        conditions: macieSourceConditions,
      }),
    );
    this.bucket.addToResourcePolicy(
      new PolicyStatement({
        sid: "AllowMaciePutResults",
        effect: Effect.ALLOW,
        principals: [maciePrincipal],
        actions: ["s3:PutObject"],
        resources: [`${this.bucket.bucketArn}/macie-results/*`],
        conditions: macieSourceConditions,
      }),
    );
  }
}
