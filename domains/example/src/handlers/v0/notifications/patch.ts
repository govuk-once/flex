import { route } from "@domain";
import { updateNotifications } from "@services/update-notifications";

export const handler = route("PATCH /v0/notifications", async ({ auth }) => {
  const data = await updateNotifications(auth.userId);

  return { status: 200, data };
});
