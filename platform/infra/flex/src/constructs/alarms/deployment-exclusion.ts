import { ArnFormat, DefaultStackSynthesizer, Stack } from "aws-cdk-lib";
import type { Construct } from "constructs";

interface DeploymentExclusionProps {
  role: "cfn-exec" | "deploy";
  regions: string[];
}

export function createDeploymentExclusion(
  scope: Construct,
  { role, regions }: DeploymentExclusionProps,
) {
  const stack = Stack.of(scope);
  const roleArns = regions.map((region) =>
    stack.formatArn({
      service: "iam",
      region: "",
      resource: "role",
      resourceName: `cdk-${DefaultStackSynthesizer.DEFAULT_QUALIFIER}-${role}-role-${stack.account}-${region}`,
      arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
    }),
  );

  const issuerBranches = [{ "anything-but": roleArns }, { exists: false }].map(
    (condition) => ({
      sessionContext: { sessionIssuer: { arn: [condition] } },
    }),
  );

  const serviceBranches =
    role === "cfn-exec"
      ? [
          { invokedBy: [{ "anything-but": "cloudformation.amazonaws.com" }] },
          { invokedBy: [{ exists: false }] },
        ]
      : [];

  return {
    userIdentity: { $or: [...issuerBranches, ...serviceBranches] },
  };
}
