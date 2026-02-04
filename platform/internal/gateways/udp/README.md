# UDP connector (service gateway)

Internal-only connector lambda for the UDP service gateway. Invoked via the **private API gateway** at `POST /internal/gateways/udp`.

- **Not** callable directly by domain lambdas; all access goes through the private API.
- Request body is validated with zod; extend `connectorRequestSchema` when integrating with a real remote UDP API.
- Response is a stable connector contract; map remote errors to 4xx/5xx without leaking internals.

See `docs/plan-private-api-gateway.md` and `plan.md` (DVLA connector pattern) for routing and ACL rules.
