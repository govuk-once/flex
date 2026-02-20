# @flex/udp/service-gateway

- This is the Anti-Corruption Layer (ACL) for the remote UDP API
- It is reachable only via the private API at /gateways/udp/{proxy+} (not by domain lambdas directly)
- It runs in the VPC (private isolated) and uses SigV4 to call the remote UDP API

---

## Commands

Run these from the repository root:

| Command                                        | Description    |
| ---------------------------------------------- | -------------- |
| `pnpm --filter @flex/udp/service-gateway lint` | Lint files     |
| `pnpm --filter @flex/udp/service-gateway test` | Run tests      |
| `pnpm --filter @flex/udp/service-gateway tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `platform/domains/udp/`.

## Handler

| Property | Value                                            |
| -------- | ------------------------------------------------ |
| Type     | Lambda (Service Gateway / ACL)                   |
| Trigger  | Private API Gateway `ANY /gateways/udp/{proxy+}` |
| Network  | VPC Private Isolated                             |

### Behaviour

- Acts as the ACL boundary between Flex and the remote UDP API
- Proxies requests to the remote service with SigV4 auth
- Translates remote responses into a stable internal contract
- Not callable directly by domain lambdas; access goes through the private API

---

## Related

**FLEX:**

- [@flex/handlers](/libs/handlers/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@platform/flex](/platform/infra/flex/README.md)
- [UDP Service Gateway construct](/platform/infra/flex/src/constructs/gateways/udp.ts)
