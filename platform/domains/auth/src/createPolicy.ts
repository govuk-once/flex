import { APIGatewayAuthorizerResult } from "aws-lambda";

export function createPolicy(
  effect: "Allow" | "Deny",
  routeArn: string,
  context?: Record<string, string>,
): APIGatewayAuthorizerResult {
  return {
    principalId: "anonymous",
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        { Action: "execute-api:Invoke", Effect: effect, Resource: routeArn },
      ],
    },
    context,
  };
}
