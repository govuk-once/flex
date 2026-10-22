# @flex/searches

Manages user search selections. Users can update their searches via the PATCH endpoint, which performs a full replacement of the `searches` array through the UDP gateway.

---

## Commands

Run these from the repository root:

| Command                                    | Description    |
|--------------------------------------------|----------------|
| `pnpm --filter @flex/searches-domain lint` | Lint files     |
| `pnpm --filter @flex/searches-domain test` | Run tests      |
| `pnpm --filter @flex/searches-domain tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `domains/searches/`.

---

## API

### Handlers

| Name                                               | Access | Description            | Code                                        |
|----------------------------------------------------|--------|------------------------|---------------------------------------------|
| [`PATCH /v1/activity/searches`](#patch-v1searches) | Public | Upsert user searches   | [View](./src/handlers/v1/activity/patch.ts) |
| [`GET /v1/activity/searches`](#get-v1searches)     | Public | Retrieve user searches | [View](./src/handlers/v1/activity/get.ts)   |

---

## PATCH `/v1/activity/searches`

Replaces the authenticated user's searches. An empty `searches` array clears all topics.

### Request

```json
{
  "searches": {
    "selectedSearches": [
      { "term": "term-1", "timestamp": "245521377" },
      { "term": "term-2", "timestamp": "245521377" }
    ]
  }
}
```

### Response

`204 No Content`

---

## GET `/v1/activity/searches`

Returns the authenticated user's searches.

### Response

```json
{
  "searches": {
    "selectedSearches": [
      { "term": "term-1", "timestamp": "245521377" },
      { "term": "term-2", "timestamp": "245521377" }
    ]
  }
}
```

> Returns empty `searches` array if the user does not exist.

---

## Related

**FLEX:**

- [@flex/sdk](/libs/sdk/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@flex/utils](/libs/utils/README.md)
- [Domain Development Guide](/docs/domain-development.md)
