import { RemovalPolicy, Stack } from "aws-cdk-lib";
import { Effect, PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
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

    this.bucket = new Bucket(this, "Bucket", {
      encryption: BucketEncryption.KMS,
      encryptionKey: this.key,
      bucketKeyEnabled: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
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

    applyCheckovSkip(
      this.bucket,
      "CKV_AWS_18",
      "Macie results bucket does not require access logging",
    );
  }
}
