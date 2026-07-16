# @flex/travel-domain

Travel Domain

---

## Commands

Run these from the repository root:

| Command                                  | Description    |
| ---------------------------------------- | -------------- |
| `pnpm --filter @flex/travel-domain lint` | Lint files     |
| `pnpm --filter @flex/travel-domain test` | Run tests      |
| `pnpm --filter @flex/travel-domain tsc ` | Run type check |

Alternatively, run `pnpm <command>` from within `domains/udp/`.

---

## API

### Handlers

| Name                          | Access           | Description                         | Code                                    |
| ----------------------------- | ---------------- | ----------------------------------- | --------------------------------------- |
| [`GET /countries`](#get-user) | Private Isolated | Returns list of countries available | [View](./src/handlers/countries/get.ts) |

### Services

## GET `/countries`

Returns a deterministic derived ID for the authenticated user.

### Configuration

### Response

```json
[
  {
    "countryId": "00000-00000-0000-00000",
    "countryName": "Spain"
  }
]
```

### Middlewares

---

## Related

**FLEX:**

- [@flex/testing](/libs/testing/README.md)
- [@platform/flex: UDP Domain](/platform/infra/flex/src/constructs/udp.ts)
- [Domain Development Guide](/docs/domain-development.md)
