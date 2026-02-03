# @flex/hello-domain

Example domain demonstrating the three Lambda deployment patterns: public, private egress, and private isolated. This domain serves as a reference for handler file structure, naming conventions, `createLambdaHandler` usage, Zod request/response schemas, and `@flex/testing` fixtures.

---

## Commands

Run these from the repository root:

| Command                                 | Description |
| --------------------------------------- | ----------- |
| `pnpm --filter @flex/hello-domain lint` | Lint files  |
| `pnpm --filter @flex/hello-domain test` | Run tests   |

Alternatively, run `pnpm <command>` from within `domains/hello/`.

---

## API

### Handlers

| Name                                         | Access           | Description                            | Code                                         |
| -------------------------------------------- | ---------------- | -------------------------------------- | -------------------------------------------- |
| [`GET /hello-public`](#get-hello-public)     | Public           | No VPC, fastest cold start             | [View](./src/handlers/hello-public/get.ts)   |
| [`GET /hello-private`](#get-hello-private)   | Private Egress   | VPC with NAT, can call external APIs   | [View](./src/handlers/hello-private/get.ts)  |
| [`GET /hello-isolated`](#get-hello-isolated) | Private Isolated | VPC without internet, highest security | [View](./src/handlers/hello-isolated/get.ts) |

---

## GET `/hello-public`

Returns a message from a public Lambda (no VPC attachment).

### Response

```json
{
  "message": "Hello public world!"
}
```

## GET `/hello-private`

Returns a message from a private egress Lambda (VPC with NAT gateway access).

### Response

```json
{
  "message": "Hello private world!"
}
```

## GET `/hello-isolated`

Returns a message from a private isolated Lambda (VPC without internet access).

### Response

```json
{
  "message": "Hello isolated world!"
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
