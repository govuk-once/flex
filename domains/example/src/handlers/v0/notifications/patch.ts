import { route } from "@domain";
import { updateNotifications } from "@services/update-notifications";

export const handler = route("PATCH /v0/notifications", async ({ auth }) => {
  const userId = auth.pairwiseId;
  const data = await updateNotifications(userId);

  return { status: 200, data };
});
