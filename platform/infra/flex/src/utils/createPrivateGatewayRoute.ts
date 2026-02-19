import { IResource, LambdaIntegration } from "aws-cdk-lib/aws-apigateway";
import { IFunction } from "aws-cdk-lib/aws-lambda";

export function createPrivateGatewayRoute(
  path: string,
  method: string,
  handler: IFunction,
  gatewayResource: IResource,
) {
  const pathSegments = path.replace(/^\//, "").split("/").filter(Boolean);
  const resource = pathSegments.reduce(
    (parent, segment) =>
      parent.getResource(segment) ?? parent.addResource(segment),
    gatewayResource,
  );
  return resource.addMethod(method, new LambdaIntegration(handler));
}
