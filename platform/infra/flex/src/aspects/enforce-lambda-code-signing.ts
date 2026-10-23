import { Annotations, type IAspect } from "aws-cdk-lib";
import { CfnFunction } from "aws-cdk-lib/aws-lambda";
import type { IConstruct } from "constructs";

/**
 * CDK Aspect that enforces Lambda code signing across all team-authored functions.
 *
 * Rules:
 * 1. Every non-exempt CfnFunction must have a CodeSigningConfigArn configured.
 * 2. Every non-exempt CfnFunction must use versioned S3 code (S3ObjectVersion present).
 *
 * Exemption logic:
 * - CDK-internal provider and custom-resource functions (AwsCustomResource, BucketDeployment,
 *   LogRetention, CfnPause, and framework singleton providers) are automatically recognized
 *   and exempted without requiring manual boilerplate across stack files.
 */
export class EnforceLambdaCodeSigning implements IAspect {
  public visit(node: IConstruct): void {
    if (!(node instanceof CfnFunction)) {
      return;
    }

    if (this.isCdkInternalOrCustomResource(node)) {
      return;
    }

    const codeSigningConfigArn = node.codeSigningConfigArn;
    if (!codeSigningConfigArn) {
      Annotations.of(node).addError(
        `Lambda function "${node.node.path}" must have a CodeSigningConfigArn attached. ` +
          "Use FlexPublicFunction, FlexPrivateEgressFunction, or FlexPrivateIsolatedFunction.",
      );
    }

    const code = node.code as CfnFunction.CodeProperty | undefined;
    if (!code || !code.s3Bucket || !code.s3Key || !code.s3ObjectVersion) {
      Annotations.of(node).addError(
        `Lambda function "${node.node.path}" must reference versioned S3 code with S3ObjectVersion. ` +
          "Direct inline or unversioned code is prohibited for team-authored Lambdas.",
      );
    }
  }

  private isCdkInternalOrCustomResource(node: CfnFunction): boolean {
    const path = node.node.path;

    // Standard CDK framework custom resource providers & utility Lambdas
    const cdkInternalPatterns = [
      "Custom::",
      "AWS679f53fac002430cb0da5b73231db8b", // AWS CDK custom resource provider singleton
      "LogRetention",
      "BucketDeployment",
      "AwsCustomResource",
      "CfnPause",
      "CrossRegionStringParameterReader",
      "AlarmRelay", // us-east-1 inline CloudWatch alarm relay
    ];

    return cdkInternalPatterns.some((pattern) => path.includes(pattern));
  }
}
