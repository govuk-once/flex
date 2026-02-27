import { ok } from "@flex/sdk";

import { route } from "../../../../domain.config";

export const handler = route(
  "PATCH /v1/user [private]",
  async ({ auth, body, headers, integrations, logger }) => {
    logger.info("Log from PATCH /v1/user [private]");

    // TODO: Implement, only available through types for now
    const result = await integrations.udpWrite({
      path: "/example",
      body: {},
      headers: {},
      query: {},
    });

    if (!result.ok) {
      // TODO: Handle error
    }

    // TODO: Temporary workaround to satisfy types
    return ok(200, {});
  },
);
