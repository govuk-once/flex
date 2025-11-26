import middy from "@middy/core";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { shuffleArray } from "../../lib/common";

const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export const handler = middy<
  APIGatewayProxyEvent,
  APIGatewayProxyResult
>().handler(() => {
  return {
    statusCode: 200,
    body: JSON.stringify(shuffleArray(numbers)),
  };
});
