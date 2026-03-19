import { CfnResource } from "aws-cdk-lib";
import { IConstruct } from "constructs";

export function applyCheckovSkip(
  construct: IConstruct,
  id: string,
  comment?: string,
) {
  const resource =
    construct instanceof CfnResource
      ? construct
      : (construct.node.defaultChild as CfnResource);

  resource.addMetadata("checkov", { skip: [{ id, comment }] });
}
