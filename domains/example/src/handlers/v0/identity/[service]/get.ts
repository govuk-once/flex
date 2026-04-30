import { route } from "@domain";
import { getIdentityLink } from "@services/get-identity-link";
import { createUserId } from "@utils/parser";

export const handler = route("GET /v0/identity/:service", async ({ auth }) => {
  const userId = createUserId(auth.pairwiseId);
  const result = await getIdentityLink(userId);

  return {
    status: 200,
    data: { linked: result !== null },
  };
});
