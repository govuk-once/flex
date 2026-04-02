import { route } from "@domain";

export const handler = route(
  "GET /v0/resources/runtime",
  async ({ logger, resources }) => {
    const { privateGatewaysRoot } = resources;

    logger.info("Runtime (middleware) resources resolved", resources);

    return await Promise.resolve({
      status: 200,
      data: { ssm: { param: privateGatewaysRoot.length } },
    });
  },
);
