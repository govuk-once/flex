import { CfnResource, IAspect } from "aws-cdk-lib";
import { CfnFunction } from "aws-cdk-lib/aws-lambda";
import { IConstruct } from "constructs";

import {
  applyCodeSigningExemption,
  CODE_SIGNING_EXEMPTION_METADATA_KEY,
  type CodeSigningExemptionMetadata,
} from "../utils/applyCodeSigningExemption";

export { applyCodeSigningExemption, CODE_SIGNING_EXEMPTION_METADATA_KEY };

function findExemptionMetadata(
  node: CfnFunction,
): { found: boolean; reason?: string } {
  const cfMetadata = node.getMetadata(CODE_SIGNING_EXEMPTION_METADATA_KEY) as
    | CodeSigningExemptionMetadata
    | undefined;
  if (cfMetadata !== undefined) {
    return {
      found: true,
      reason: typeof cfMetadata?.reason === "string" ? cfMetadata.reason : "",
    };
  }

  for (const scope of [...node.node.scopes].reverse()) {
    const entry = scope.node.metadata.find(
      (m) => m.type === CODE_SIGNING_EXEMPTION_METADATA_KEY,
    );
    if (entry) {
      const data = entry.data as CodeSigningExemptionMetadata | undefined;
      return {
        found: true,
        reason: typeof data?.reason === "string" ? data.reason : "",
      };
    }

    const defaultChild = scope.node.defaultChild;
    if (defaultChild instanceof CfnResource) {
      const childMeta = defaultChild.getMetadata(
        CODE_SIGNING_EXEMPTION_METADATA_KEY,
      ) as CodeSigningExemptionMetadata | undefined;
      if (childMeta !== undefined) {
        return {
          found: true,
          reason:
            typeof childMeta?.reason === "string" ? childMeta.reason : "",
        };
      }
    }
  }

  return { found: false };
}

/**
 * App-level CDK Aspect enforcing that every `AWS::Lambda::Function` resource
 * carries a `CodeSigningConfigArn` and a versioned S3 `Code` reference
 * (`S3Bucket`, `S3Key`, `S3ObjectVersion`), unless explicitly exempted via
 * `applyCodeSigningExemption(construct, reason)` with a non-empty audit reason.
 */
export class EnforceLambdaCodeSigning implements IAspect {
  public visit(node: IConstruct): void {
    if (!(node instanceof CfnFunction)) {
      return;
    }

    const exemption = findExemptionMetadata(node);
    if (exemption.found) {
      if (!exemption.reason || exemption.reason.trim().length === 0) {
        throw new Error(
          `Code signing exemption on "${node.node.path}" requires a non-empty audit reason.`,
        );
      }
      return;
    }

    const hasCodeSigningConfig =
      node.codeSigningConfigArn !== undefined &&
      node.codeSigningConfigArn !== "";

    const codeProp = node.code as CfnFunction.CodeProperty | undefined;
    const hasVersionedS3Code =
      codeProp !== undefined &&
      typeof codeProp === "object" &&
      codeProp.zipFile === undefined &&
      Boolean(codeProp.s3Bucket) &&
      Boolean(codeProp.s3Key) &&
      Boolean(codeProp.s3ObjectVersion);

    if (!hasCodeSigningConfig || !hasVersionedS3Code) {
      const missing: string[] = [];
      if (!hasCodeSigningConfig) {
        missing.push("CodeSigningConfigArn");
      }
      if (!hasVersionedS3Code) {
        missing.push(
          "versioned S3 Code (S3Bucket, S3Key, S3ObjectVersion without inline ZipFile)",
        );
      }

      throw new Error(
        `Lambda function "${node.node.path}" is missing required code signing configuration: ${missing.join(" and ")}. Team-authored Lambdas must use signed artifacts from the manifest, and CDK provider Lambdas must use applyCodeSigningExemption() with an audit reason.`,
      );
    }
  }
}
