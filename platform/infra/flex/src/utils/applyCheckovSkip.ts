import { CfnResource } from "aws-cdk-lib";
import { IConstruct } from "constructs";

export function applyCheckovSkip(
  construct: IConstruct,
  id: string,
  comment?: string,
) {
  const defaultChild = construct.node.defaultChild as CfnResource;
  defaultChild.addMetadata("checkov", { skip: [{ id, comment }] });
}
