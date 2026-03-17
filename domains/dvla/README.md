# @flex/dvla-domain

Domain description here.

---

## Commands

Run these from the repository root:

| Command                                      | Description    |
| -------------------------------------------- | -------------- |
| `pnpm --filter @flex/dvla-domain lint` | Lint files     |
| `pnpm --filter @flex/dvla-domain test` | Run tests      |
| `pnpm --filter @flex/dvla-domain tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `domains/dvla/`.

---

## API

### Handlers

| Name                           | Access           | Description                            | Code                                  |
| ------------------------------ | ---------------- | -------------------------------------- | ------------------------------------- |
| [`GET /hello`](#get-hello)     | Public           | No VPC, fastest cold start             | [View](./src/handlers/hello/get.ts)   |

---

## GET `/hello`

Returns a message from a public Lambda (no VPC attachment).

### Response

```json
{
  "message": "Hello world!"
}
```

---

## Related

**FLEX:**

- [@flex/handlers](/libs/handlers/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@platform/flex](/platform/infra/flex/README.md)
- [@platform/flex: Hello Domain](/platform/infra/flex/src/stack.ts)
- [Domain Development Guide](/docs/domain-development.md)
