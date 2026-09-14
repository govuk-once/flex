import { IAspect } from "aws-cdk-lib";
import { CfnLogGroup } from "aws-cdk-lib/aws-logs";
import { IConstruct } from "constructs";

import { resolveLogGroupEncryptionKey } from "../utils/logs";

export class EncryptLogGroups implements IAspect {
  public visit(node: IConstruct): void {
    if (node instanceof CfnLogGroup && node.kmsKeyId === undefined) {
      node.kmsKeyId = resolveLogGroupEncryptionKey(node).keyArn;
    }
  }
}
