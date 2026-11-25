import { Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { Key } from "aws-cdk-lib/aws-kms";
import { describe, it } from "vitest";

import { FlowLogBucket } from "./FlowLogBucket";

describe("FlowLogBucket", () => {
  it("locks flow logs for a year under compliance mode so no identity can delete them early", () => {
    const stack = new Stack(undefined, "TestStack");
    new FlowLogBucket(stack, "FlowLogs", new Key(stack, "Key"));

    Template.fromStack(stack).hasResourceProperties("AWS::S3::Bucket", {
      ObjectLockEnabled: true,
      ObjectLockConfiguration: {
        Rule: { DefaultRetention: { Mode: "COMPLIANCE", Days: 365 } },
      },
    });
  });
});
