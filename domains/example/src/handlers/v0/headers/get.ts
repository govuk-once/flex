import { route } from "@domain";

export const handler = route("GET /v0/headers", ({ headers, logger }) => {
  const { requestId, correlationId, exampleId } = headers;

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
