import { CfnResource, Stack } from "aws-cdk-lib";
import { CfnFunction } from "aws-cdk-lib/aws-lambda";
import { IConstruct } from "constructs";

export const CODE_SIGNING_EXEMPTION_METADATA_KEY =
  "flex:code-signing-exemption";

export interface CodeSigningExemptionMetadata {
  readonly reason: string;
}

const AWS_CUSTOM_RESOURCE_PROVIDER_ID_PREFIX =
  "AWS679f53fac002430cb0da5b7982bd2287";
const BUCKET_DEPLOYMENT_PROVIDER_ID_PREFIX = "Custom::CDKBucketDeployment";

function attachExemptionMetadata(target: IConstruct, reason: string): void {
  target.node.addMetadata(CODE_SIGNING_EXEMPTION_METADATA_KEY, {
    reason,
  } satisfies CodeSigningExemptionMetadata);

  const defaultChild = target.node.defaultChild;
  if (defaultChild instanceof CfnResource) {
    defaultChild.addMetadata(CODE_SIGNING_EXEMPTION_METADATA_KEY, {
      reason,
    } satisfies CodeSigningExemptionMetadata);
  }
}

/**
 * Exempts a CDK construct (such as a framework-generated custom-resource provider Lambda)
 * from the `EnforceLambdaCodeSigning` aspect.
 *
 * Mirrors `applyCheckovSkip`: requires a mandatory non-empty `reason` audit comment
 * explaining why the Lambda is exempt from team-authored code signing.
 */
export function applyCodeSigningExemption(
  construct: IConstruct,
  reason: string,
): void {
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error(
      `Code signing exemption on "${construct.node.path}" requires a non-empty audit reason.`,
    );
  }

  attachExemptionMetadata(construct, trimmedReason);

  // Also mark any CfnFunction descendants under this construct (e.g. CfnPause -> Fn & Provider)
  for (const child of construct.node.findAll()) {
    if (child instanceof CfnFunction) {
      attachExemptionMetadata(child, trimmedReason);
    }
  }

  // If this construct is an AwsCustomResource or BucketDeployment, CDK places the singleton
  // provider Lambda at the Stack root. Mark matching stack-singleton provider constructs too.
  const constructTypeName = construct.constructor.name;
  const stack = Stack.of(construct);

  if (constructTypeName === "AwsCustomResource") {
    for (const stackChild of stack.node.children) {
      if (stackChild.node.id.startsWith(AWS_CUSTOM_RESOURCE_PROVIDER_ID_PREFIX)) {
        attachExemptionMetadata(stackChild, trimmedReason);
      }
    }
  }

  if (constructTypeName === "BucketDeployment") {
    for (const stackChild of stack.node.children) {
      if (stackChild.node.id.startsWith(BUCKET_DEPLOYMENT_PROVIDER_ID_PREFIX)) {
        attachExemptionMetadata(stackChild, trimmedReason);
      }
    }
  }
}
