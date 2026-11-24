import { Bucket } from "aws-cdk-lib/aws-s3";
import { CfnLoggingConfiguration, CfnWebACL } from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";

import { WafLogBucket } from "../s3/WafLogBucket";

export const WAF_LOG_REDACTED_HEADERS = [
  "authorization",
  "cookie",
  "x-origin-verify",
  "x-flex-e2e-bypass",
  "x-linking-token",
] as const;

export const WAF_LOGGED_ACTIONS = ["BLOCK", "COUNT"] as const;

export interface WafRequestLoggingProps {
  readonly webAcl: CfnWebACL;
  readonly bucketNameSuffix: string;
  readonly retentionDays?: number;
}

export class WafRequestLogging extends Construct {
  public readonly bucket: Bucket;

  constructor(
    scope: Construct,
    id: string,
    { webAcl, bucketNameSuffix, retentionDays }: WafRequestLoggingProps,
  ) {
    super(scope, id);

    this.bucket = new WafLogBucket(this, "Bucket", {
      bucketNameSuffix,
      retentionDays,
    }).bucket;

    const loggingConfiguration = new CfnLoggingConfiguration(
      this,
      "LoggingConfiguration",
      {
        resourceArn: webAcl.attrArn,
        logDestinationConfigs: [this.bucket.bucketArn],
        redactedFields: WAF_LOG_REDACTED_HEADERS.map((name) => ({
          singleHeader: { Name: name },
        })),
        loggingFilter: {
          DefaultBehavior: "DROP",
          Filters: [
            {
              Behavior: "KEEP",
              Requirement: "MEETS_ANY",
              Conditions: WAF_LOGGED_ACTIONS.map((action) => ({
                ActionCondition: { Action: action },
              })),
            },
          ],
        },
      },
    );

    if (this.bucket.policy) {
      loggingConfiguration.node.addDependency(this.bucket.policy);
    }
  }
}
