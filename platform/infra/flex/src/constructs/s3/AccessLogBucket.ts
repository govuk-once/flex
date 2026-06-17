import { Duration } from "aws-cdk-lib";
import {
  BlockPublicAccess,
  Bucket,
  BucketAccessControl,
  ObjectLockMode,
  ObjectOwnership,
} from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

import { applyCheckovSkip } from "../../utils/applyCheckovSkip";

export class AccessLogBucket extends Construct {
  public readonly bucket: Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.bucket = new Bucket(this, "AccessLogBucket", {
      enforceSSL: true,
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
      this.bucket,
      "CKV_AWS_18",
      "Log bucket intentionally does not log",
    );
  }
}
