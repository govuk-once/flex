import { route } from "@domain";

export const handler = route(
  "GET /v0/resources/runtime",
  async ({ logger, resources }) => {
    const { privateGatewaysRoot } = resources;

    // async noop
    await Promise.resolve(null);

    logger.info("Runtime (middleware) resources resolved", resources);

    return {
      status: 200,
      data: { ssm: { param: privateGatewaysRoot.length } },
    };
  },
);
