import { route } from "@domain";
import { status } from "http-status";

export const handler = route(
  "GET /v1/driving-licence",
  async ({ auth, logger, integrations }) => {
    try {
      await integrations.dvlaGet({ path: "/driving-licence" });
    } catch {
      logger.info("TODO implement driving-licence integration");
    }
    return { status: status.OK };
  },
);
