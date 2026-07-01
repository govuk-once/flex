import { Duration } from "aws-cdk-lib";
import { IKey } from "aws-cdk-lib/aws-kms";
import {
  BlockPublicAccess,
  Bucket,
  BucketAccessControl,
  BucketEncryption,
  ObjectLockMode,
  ObjectOwnership,
} from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

import { applyCheckovSkip } from "../../utils/applyCheckovSkip";

export class FlowLogBucket extends Construct {
  public readonly bucket: Bucket;

  constructor(scope: Construct, id: string, encryptionKey: IKey) {
    super(scope, id);

    this.bucket = new Bucket(this, "FlowLogBucket", {
      enforceSSL: true,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.OBJECT_WRITER,
      accessControl: BucketAccessControl.LOG_DELIVERY_WRITE,
      encryption: BucketEncryption.KMS,
      encryptionKey,
      bucketKeyEnabled: true,
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
      this.bucket,
      "CKV_AWS_18",
      "Log bucket intentionally does not log",
    );
  }
}
