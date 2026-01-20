import { APIGatewayAuthorizerResult, APIGatewayRequestAuthorizerEvent } from "aws-lambda";
import { exampleValidJWT } from "./mockJwks";

export const baseEvent: APIGatewayRequestAuthorizerEvent = {
  version: "2.0",
  type: "REQUEST",
  routeArn:
    "arn:aws:execute-api:eu-west-2:123456789012:abcdef123/test/GET/request",
  identitySource: [`Bearer ${exampleValidJWT}`],
  routeKey: "GET /test",
  rawPath: "/test",
  rawQueryString: "",
  headers: {
    authorization: `Bearer ${exampleValidJWT}`,
  },
  requestContext: {
    accountId: "123456789012",
    requestId: "test-request-id",
  },
  stageVariables: null,
} as unknown as APIGatewayRequestAuthorizerEvent;

export const expectedPolicy: APIGatewayAuthorizerResult = {
  principalId: "anonymous",
  policyDocument: {
    Version: "2012-10-17",
    Statement: [
      {
        Action: "execute-api:Invoke",
        Effect: "Allow",
        Resource: "*",
      },
    ],
  },
  context: {
    pairwiseId: "onelogin_urn:fdc:gov.uk:2022:SwProvIeT-P_oLN2JHRrJvV2yaC2mM3vRI_NrlW2yt0",
  },
};
