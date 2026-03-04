import * as logger from "@flex/logging";
import { context, event, it } from "@flex/testing";
import type { MiddlewareObj } from "@middy/core";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import createHttpError from "http-errors";
import { beforeEach, describe, expect, vi } from "vitest";

import { createLambdaHandler } from "./createLambdaHandler";

vi.spyOn(logger, "getLogger");
vi.spyOn(logger, "injectLambdaContext");

const baseLoggerOptions = {
  logLevel: "INFO",
  serviceName: "test-service",
} as const;

describe("createLambdaHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic handler creation", () => {
    it("creates a middy handler from a simple handler function", async ({
      response,
    }) => {
      const expectedResponse = response.ok({ message: "success" });

      const handler = createLambdaHandler(
        async () => Promise.resolve(expectedResponse),
        baseLoggerOptions,
      );

      const result = await handler(event, context);

      expect(result).toEqual(expectedResponse);
    });
  });

  it("handles errors thrown by the handler", async ({ response }) => {
    const handler = createLambdaHandler(() => {
      throw new createHttpError.BadRequest("Test error");
    }, baseLoggerOptions);

    const result = await handler(event, context);

    expect(result).toEqual(
      response.badRequest("Test error", {
        headers: { "Content-Type": "text/plain" },
      }),
    );
  });

  describe("arbitrary middleware support", () => {
    it("applies middleware to the handler", async ({
      event: customEvent,
      response,
    }) => {
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
      const expectedResponse = response.ok({ message: "success" });

      const handler = createLambdaHandler(
        async () => Promise.resolve(expectedResponse),
        {
          middlewares: [middleware],
          ...baseLoggerOptions,
        },
      );

      await handler(testEvent, context);

      expect(beforeMiddleware).toHaveBeenCalledExactlyOnceWith(testEvent);
      expect(afterMiddleware).toHaveBeenCalledExactlyOnceWith(expectedResponse);
    });

    it("applies multiple middlewares in order", async ({ response }) => {
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

      const expectedResponse = response.ok({ message: "success" });
      const handler = createLambdaHandler(
        async () => {
          callOrder.push("handler");
          return Promise.resolve(expectedResponse);
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
    it("injects logger context into the handler", async ({ response }) => {
      const expectedResponse = response.ok({ message: "success" });
      const handler = createLambdaHandler(
        async () => Promise.resolve(expectedResponse),
        { ...baseLoggerOptions },
      );

      await handler(event, context);

      expect(logger.getLogger).toHaveBeenCalledOnce();
      expect(logger.injectLambdaContext).toHaveBeenCalledExactlyOnceWith(
        logger.getLogger(),
        expect.any(Object),
      );
    });

    it.for([
      { logLevel: "DEBUG", expected: true },
      { logLevel: "debug", expected: true },
      { logLevel: "TRACE", expected: true },
      { logLevel: "trace", expected: true },
      { logLevel: "INFO", expected: false },
      { logLevel: "info", expected: false },
    ] as const)(
      "sets the logger integration logEvent parmeter to $expected if log level is $logLevel",
      async ({ expected, logLevel }, { response }) => {
        const expectedResponse = response.ok({ message: "success" });
        const handler = createLambdaHandler(
          async () => Promise.resolve(expectedResponse),
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

    it("passes correlationIdPath to logger middleware", async ({
      response,
    }) => {
      const expectedResponse = response.ok({ message: "success" });
      const handler = createLambdaHandler(
        async () => Promise.resolve(expectedResponse),
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
      response,
    }) => {
      const handler = createLambdaHandler<
        APIGatewayProxyEventV2,
        APIGatewayProxyResultV2
      >(
        async (event) =>
          Promise.resolve(
            response.ok({ userId: event.pathParameters?.userId }),
          ),
        {
          ...baseLoggerOptions,
        },
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
    it("creates a handler when no middlewares are provided", async ({
      response,
    }) => {
      const expectedResponse = response.created({ created: true });
      const handler = createLambdaHandler(
        async () => Promise.resolve(expectedResponse),
        { ...baseLoggerOptions },
      );

      const result = await handler(event, context);

      expect(result).toBe(expectedResponse);
    });
  });
});
