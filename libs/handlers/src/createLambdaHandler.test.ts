import * as logger from "@flex/logging";
import { context, event, it } from "@flex/testing";
import type { MiddlewareObj } from "@middy/core";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { beforeEach, describe, expect, vi } from "vitest";

import { createLambdaHandler } from "./createLambdaHandler";

vi.spyOn(logger, "getLogger");
vi.spyOn(logger, "injectLambdaContext");

const baseLoggerOptions = {
  logLevel: "INFO",
  serviceName: "test-service",
} as const;

const mockResponse = {
  OK: { statusCode: 200, body: JSON.stringify({ message: "success" }) },
  CREATED: { statusCode: 201, body: JSON.stringify({ created: true }) },
} as const;

describe("createLambdaHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic handler creation", () => {
    it("creates a middy handler from a simple handler function", async () => {
      const handler = createLambdaHandler(
        async () => Promise.resolve(mockResponse.OK),
        baseLoggerOptions,
      );

      const result = await handler(event, context);

      expect(result).toEqual(mockResponse.OK);
    });
  });

  describe("arbitrary middleware support", () => {
    it("applies middleware to the handler", async ({ event: customEvent }) => {
      const beforeMiddleware = vi.fn();
      const afterMiddleware = vi.fn();

      const middleware: MiddlewareObj<
        APIGatewayProxyEventV2,
        APIGatewayProxyResultV2
      > = {
        before: (request) => {
          beforeMiddleware(request.event);
        },
        after: (request) => {
          afterMiddleware(request.response);
        },
      };

      const testEvent = customEvent.get("/test");

      const handler = createLambdaHandler(
        async () => Promise.resolve(mockResponse.OK),
        {
          middlewares: [middleware],
          ...baseLoggerOptions,
        },
      );

      await handler(testEvent, context);

      expect(beforeMiddleware).toHaveBeenCalledExactlyOnceWith(testEvent);
      expect(afterMiddleware).toHaveBeenCalledExactlyOnceWith(mockResponse.OK);
    });

    it("applies multiple middlewares in order", async () => {
      const callOrder: string[] = [];

      const middleware1: MiddlewareObj<
        APIGatewayProxyEventV2,
        APIGatewayProxyResultV2
      > = {
        before: () => {
          callOrder.push("middleware1-before");
        },
        after: () => {
          callOrder.push("middleware1-after");
        },
      };

      const middleware2: MiddlewareObj<
        APIGatewayProxyEventV2,
        APIGatewayProxyResultV2
      > = {
        before: () => {
          callOrder.push("middleware2-before");
        },
        after: () => {
          callOrder.push("middleware2-after");
        },
      };

      const handler = createLambdaHandler(
        async () => {
          callOrder.push("handler");
          return Promise.resolve(mockResponse.OK);
        },
        {
          middlewares: [middleware1, middleware2],
          ...baseLoggerOptions,
        },
      );

      await handler(event, context);

      expect(callOrder).toEqual([
        "middleware1-before",
        "middleware2-before",
        "handler",
        "middleware2-after",
        "middleware1-after",
      ]);
    });
  });

  describe("logging integration", () => {
    it("injects logger context into the handler", async () => {
      const handler = createLambdaHandler(
        async () => Promise.resolve(mockResponse.OK),
        { ...baseLoggerOptions },
      );

      await handler(event, context);

      expect(logger.getLogger).toHaveBeenCalledOnce();
      expect(logger.injectLambdaContext).toHaveBeenCalledExactlyOnceWith(
        logger.getLogger(),
        expect.any(Object),
      );
    });

    it.each([
      { logLevel: "DEBUG" as const, expected: true },
      { logLevel: "debug" as const, expected: true },
      { logLevel: "TRACE" as const, expected: true },
      { logLevel: "trace" as const, expected: true },
      { logLevel: "INFO" as const, expected: false },
      { logLevel: "info" as const, expected: false },
    ])(
      "sets the logger integration logEvent parmeter to $expected if log level is $logLevel",
      async ({ expected, logLevel }) => {
        const handler = createLambdaHandler(
          async () => Promise.resolve(mockResponse.OK),
          { ...baseLoggerOptions, logLevel },
        );

        await handler(event, context);

        expect(logger.getLogger).toHaveBeenCalledOnce();
        expect(logger.injectLambdaContext).toHaveBeenCalledExactlyOnceWith(
          expect.anything(),
          expect.objectContaining({ logEvent: expected }),
        );
      },
    );

    it("passes correlationIdPath to logger middleware", async () => {
      const handler = createLambdaHandler(
        async () => Promise.resolve(mockResponse.OK),
        { ...baseLoggerOptions },
      );

      await handler(event, context);

      expect(logger.getLogger).toHaveBeenCalledOnce();
      expect(logger.injectLambdaContext).toHaveBeenCalledExactlyOnceWith(
        expect.anything(),
        expect.objectContaining({
          correlationIdPath: "requestContext.requestId",
        }),
      );
    });
  });

  describe("type safety", () => {
    it("maintains type safety for event and response types", async ({
      event: customEvent,
    }) => {
      const handler = createLambdaHandler<
        APIGatewayProxyEventV2,
        APIGatewayProxyResultV2
      >(
        async (event) =>
          Promise.resolve({
            statusCode: 200,
            body: JSON.stringify({ userId: event.pathParameters?.userId }),
          }),
        { ...baseLoggerOptions },
      );

      const userId = "user-123";

      const result = await handler(
        customEvent.create({ pathParameters: { userId } }),
        context,
      );

      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({ userId }),
      });
    });
  });

  describe("handler without middlewares", () => {
    it("creates a handler when no middlewares are provided", async () => {
      const handler = createLambdaHandler(
        async () => Promise.resolve(mockResponse.CREATED),
        { ...baseLoggerOptions },
      );

      const result = await handler(event, context);

      expect(result).toBe(mockResponse.CREATED);
    });
  });
});
