import { IResource } from "aws-cdk-lib/aws-apigateway";

export function addDeepResource(root: IResource, path: string): IResource {
  const parts = path.split("/").filter(Boolean);
  let current = root;

  for (const part of parts) {
    const existing = current.node.tryFindChild(part) as IResource | undefined;
    current = existing ?? current.addResource(part);
  }

  return current;
}
