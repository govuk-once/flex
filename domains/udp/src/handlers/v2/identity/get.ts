import { route } from "@domain";
import { getAllIdentities } from "@services/identities";
import status from "http-status";

export const handler = route("GET /v2/identity", async (ctx) => {
  const response = await getAllIdentities(ctx);

  return {
    status: status.OK,
    data:
      response === status.NOT_FOUND
        ? { linkedServices: [] }
        : { linkedServices: response.linkedServices },
  };
});
