import { CloudFrontFunctionsEvent } from "aws-lambda";
import { mergeDeepLeft } from "ramda";

import { DeepPartial } from "../../../utils/src/types";

const baseCloudFrontEvent: CloudFrontFunctionsEvent = {
  version: "1.0",
  context: {
    distributionDomainName: "d1234567890.cloudfront.net",
    distributionId: "EDFDVBD6EXAMPLE",
    eventType: "viewer-request",
    requestId: "test-request-id",
  },
  viewer: {
    ip: "192.0.2.1",
  },
  request: {
    method: "GET",
    uri: "/test",
    querystring: {},
    headers: {},
    cookies: {},
  },
  response: {
    statusCode: 200,
    headers: {},
    cookies: {},
  },
};

type CloudFrontEventOverrides = DeepPartial<CloudFrontFunctionsEvent>;

export function buildCloudFrontEvent(overrides: CloudFrontEventOverrides = {}) {
  return mergeDeepLeft(
    overrides,
    baseCloudFrontEvent,
  ) as CloudFrontFunctionsEvent;
}

export function buildCloudFrontEventWithAuthorizationHeader(header: string) {
  return buildCloudFrontEvent({
    request: {
      headers: {
        authorization: {
          value: header,
        },
      },
    },
  });
}

export const cloudfrontEvent = buildCloudFrontEvent();

type CloudFrontFunctionResponse = {
  statusCode: number;
  headers?: {
    [key: string]: { value: string };
  };
  body?: {
    encoding: "text" | "base64";
    data: string;
  };
};

const baseCloudFrontResponse: CloudFrontFunctionResponse = {
  statusCode: 200,
  headers: {
    "content-type": { value: "application/json" },
  },
  body: {
    encoding: "text",
    data: "Hello, world!",
  },
};

type CloudFrontFunctionResponseOverrides =
  DeepPartial<CloudFrontFunctionResponse>;

export function buildCloudFrontFunctionResponse(
  overrides: CloudFrontFunctionResponseOverrides = {},
): CloudFrontFunctionResponse {
  return mergeDeepLeft(
    overrides,
    baseCloudFrontResponse,
  ) as CloudFrontFunctionResponse;
}

export function buildCloudFrontFunctionErrorResponse(
  message: string,
): CloudFrontFunctionResponse {
  return buildCloudFrontFunctionResponse({
    statusCode: 401,
    body: {
      encoding: "text",
      data: message,
    },
    headers: {
      "content-type": { value: "application/json" },
      "x-rejected-by": { value: "cloudfront-function" },
    },
  });
}
