import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";

import { MacieResultsBucket } from "./MacieResultsBucket";

function synthesise() {
  const app = new App({
    context: { "@aws-cdk/aws-s3:serverAccessLogsUseBucketPolicy": true },
  });
  const stack = new Stack(app, "TestStack", {
    env: { account: "123456789012", region: "us-east-1" },
  });
  new MacieResultsBucket(stack, "Results");

  return Template.fromStack(stack);
}

type BucketResource = {
  Properties: Record<string, unknown>;
  Metadata?: { checkov?: { skip: { id: string }[] } };
};

function buckets(template: Template) {
  const all = Object.entries(template.findResources("AWS::S3::Bucket")) as [
    string,
    BucketResource,
  ][];
  const results = all.find(
    ([, bucket]) => "LoggingConfiguration" in bucket.Properties,
  );
  const accessLogs = all.find(
    ([, bucket]) => !("LoggingConfiguration" in bucket.Properties),
  );
  if (!results || !accessLogs) {
    throw new Error("expected a results bucket and an access log bucket");
  }
  return { results, accessLogs };
}

describe("MacieResultsBucket", () => {
  it("sends the results bucket's server access logs to a separate bucket", () => {
    const template = synthesise();
    const { accessLogs } = buckets(template);

    template.resourceCountIs("AWS::S3::Bucket", 2);
    template.hasResourceProperties("AWS::S3::Bucket", {
      LoggingConfiguration: { DestinationBucketName: { Ref: accessLogs[0] } },
    });
  });

  it("no longer skips the access logging check on the results bucket", () => {
    const { results } = buckets(synthesise());

    expect(results[1].Metadata?.checkov).toBeUndefined();
  });

  it("keeps the access log bucket deliverable by S3 log delivery", () => {
    const { accessLogs } = buckets(synthesise());

    expect(accessLogs[1].Properties).not.toHaveProperty("ObjectLockEnabled");
    expect(accessLogs[1].Properties).toMatchObject({
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          { ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } },
        ],
      },
    });
  });

  it("lets the S3 logging service write to the access log bucket", () => {
    const template = synthesise();
    const { accessLogs } = buckets(template);

    template.hasResourceProperties("AWS::S3::BucketPolicy", {
      Bucket: { Ref: accessLogs[0] },
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "s3:PutObject",
            Effect: "Allow",
            Principal: { Service: "logging.s3.amazonaws.com" },
          }),
        ]),
      },
    });
  });

  it("expires access logs after a year", () => {
    const { accessLogs } = buckets(synthesise());

    expect(accessLogs[1].Properties).toMatchObject({
      LifecycleConfiguration: {
        Rules: [{ ExpirationInDays: 365, Status: "Enabled" }],
      },
    });
  });
});
