import { route } from "@domain";

export const handler = route("GET /v0/headers", async ({ headers, logger }) => {
  const { requestId, correlationId, exampleId } = headers;

  // async noop
  await Promise.resolve(null);

  logger.info("Headers received", { requestId, correlationId, exampleId });

  return {
    status: 200,
    data: {
      requestId,
      correlationId: correlationId ?? null,
      exampleId: exampleId ?? null,
    },
  };
});
