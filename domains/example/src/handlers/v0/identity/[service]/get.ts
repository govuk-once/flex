import { route } from "@domain";
import { getIdentityLink } from "@services/get-identity-link";

export const handler = route("GET /v0/identity/:service", async ({ auth }) => {
  const userId = auth.pairwiseId;
  const result = await getIdentityLink(userId);

  return {
    status: 200,
    data: { linked: result !== null },
  };
});
