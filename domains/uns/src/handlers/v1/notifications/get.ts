import { route } from "../../../../domain.config";
import { MOCK_NOTIFICATIONS } from "../../../data/notifications";

export const handler = route("GET /v1/notifications", ({ logger }) => {
  logger.debug("Fetching notifications");

  return Promise.resolve({ status: 200, data: MOCK_NOTIFICATIONS });
});
