import { route } from "@domain";
import status from "http-status";

import { getAllIdentities } from "../../../services/identities";

export const handler = route("GET /v1/identity", async (ctx) => {
  const response = await getAllIdentities(ctx);

  if (response === status.NOT_FOUND) return { status: status.NO_CONTENT };

  return {
    status: status.OK,
    data: response.data,
  };
});
