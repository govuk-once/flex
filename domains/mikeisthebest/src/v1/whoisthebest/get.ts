import { route } from "@domain";

export const handler = route("GET /v1/whoisthebest", async (context) => {
  const { auth, logger } = context;

  logger.info("Letting everyone know that mike is the best...", {
    userId: auth.userId,
  });

  return { status: 200, data: { message: "Mike is the best!" } };
});
