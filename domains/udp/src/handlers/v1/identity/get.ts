import { route } from "@domain";
import { getAllIdentities } from "@services/identities";
import status from "http-status";

export const handler = route("GET /v1/identity", async (ctx) => {
  const response = await getAllIdentities(ctx);

  if (response === status.NOT_FOUND) return { status: status.NO_CONTENT };

  const { data: services } = response;

  return { status: status.OK, data: services };
});
