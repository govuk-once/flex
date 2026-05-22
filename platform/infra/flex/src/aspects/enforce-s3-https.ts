import { IAspect } from "aws-cdk-lib";
import { AnyPrincipal, Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { IConstruct } from "constructs";

export class EnforceS3Https implements IAspect {
  public visit(node: IConstruct): void {
    if (node instanceof Bucket) {
      node.addToResourcePolicy(
        new PolicyStatement({
          effect: Effect.DENY,
          principals: [new AnyPrincipal()],
          actions: ["s3:*"],
          resources: [node.bucketArn, `${node.bucketArn}/*`],
          conditions: {
            Bool: { "aws:SecureTransport": "false" },
          },
        }),
      );
    }
  }
}
