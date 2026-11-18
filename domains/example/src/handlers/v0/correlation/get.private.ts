import { route } from "@domain";

// Echoes the x-correlation-id header as received on the wire, so callers can
// confirm it was forwarded across the private gateway
export const handler = route(
  "GET /v0/correlation [private]",
  ({ headers }) => ({
    status: 200,
    data: { correlationId: headers.correlationId ?? null },
  }),
);
