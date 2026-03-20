# @flex/dvla/service-gateway

- This is the Anti-Corruption Layer (ACL) for the remote DVLA API
- It is reachable only via the private API at /gateways/dvla/{proxy+} (not by domain lambdas directly)
- It runs in the VPC (private isolated) and uses SigV4 to call the remote DVLA API

---

## Commands

Run these from the repository root:

| Command                                         | Description    |
| ----------------------------------------------- | -------------- |
| `pnpm --filter @flex/dvla/service-gateway lint` | Lint files     |
| `pnpm --filter @flex/dvla/service-gateway test` | Run tests      |
| `pnpm --filter @flex/dvla/service-gateway tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `platform/domains/dvla/`.

## Handler

| Property | Value                                             |
| -------- | ------------------------------------------------- |
| Type     | Lambda (Service Gateway / ACL)                    |
| Trigger  | Private API Gateway `ANY /gateways/dvla/{proxy+}` |
| Network  | VPC Private Isolated                              |

### Behaviour

- Acts as the ACL boundary between Flex and the remote DVLA API
- Proxies requests to the remote service with SigV4 auth
- Translates remote responses into a stable internal contract
- Not callable directly by domain lambdas; access goes through the private API

---

## Related

**FLEX:**

- [@flex/handlers](/libs/handlers/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@platform/flex](/platform/infra/flex/README.md)
- [DVLA Service Gateway construct](/platform/infra/flex/src/constructs/gateways/dvla.ts)
