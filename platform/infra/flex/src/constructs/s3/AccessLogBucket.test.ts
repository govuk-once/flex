import { Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { afterEach, describe, it, vi } from "vitest";

async function synthesise(stage: string, retentionDays?: number) {
  vi.resetModules();
  vi.stubEnv("STAGE", stage);
  const { AccessLogBucket } = await import("./AccessLogBucket");

  const stack = new Stack(undefined, "TestStack");
  new AccessLogBucket(stack, "AccessLogs", retentionDays);

  return Template.fromStack(stack);
}

describe("AccessLogBucket", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    { stage: "development" },
    { stage: "staging" },
    { stage: "production" },
  ])(
    "locks access logs in $stage under compliance mode so no identity can delete them early",
    async ({ stage }) => {
      const template = await synthesise(stage);

      template.hasResourceProperties("AWS::S3::Bucket", {
        ObjectLockEnabled: true,
        ObjectLockConfiguration: {
          Rule: { DefaultRetention: { Mode: "COMPLIANCE", Days: 365 } },
        },
      });
    },
  );

  it("locks access logs in an ephemeral stage under governance mode so the bucket can be emptied once the stage is destroyed", async () => {
    const template = await synthesise("pr-123");

    template.hasResourceProperties("AWS::S3::Bucket", {
      ObjectLockEnabled: true,
      ObjectLockConfiguration: {
        Rule: { DefaultRetention: { Mode: "GOVERNANCE", Days: 365 } },
      },
    });
  });

  it("expires access logs on the day their lock ends", async () => {
    const template = await synthesise("staging", 90);

    template.hasResourceProperties("AWS::S3::Bucket", {
      ObjectLockConfiguration: {
        Rule: { DefaultRetention: { Mode: "COMPLIANCE", Days: 90 } },
      },
      LifecycleConfiguration: {
        Rules: [
          Match.objectLike({
            ExpirationInDays: 90,
            NoncurrentVersionExpiration: { NoncurrentDays: 90 },
          }),
        ],
      },
    });
  });
});
