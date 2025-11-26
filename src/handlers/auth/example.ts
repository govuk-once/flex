import { APIGatewayEventRequestContext, APIGatewayRequestAuthorizerEventV2 } from "aws-lambda";

export function handler(_event: APIGatewayRequestAuthorizerEventV2, context: APIGatewayEventRequestContext) {
   return {
    isAuthorized: true,
    context
  };
}