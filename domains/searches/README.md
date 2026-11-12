# @flex/searches-domain

Manages user searches. Users can update their searches via the PATCH endpoint, which adds a search on the `selectedsearches` array through the UDP gateway.

---

## Commands

Run these from the repository root:

| Command                                    | Description    |
| ------------------------------------------ | -------------- |
| `pnpm --filter @flex/searches-domain lint` | Lint files     |
| `pnpm --filter @flex/searches-domain test` | Run tests      |
| `pnpm --filter @flex/searches-domain tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `domains/searches/`.

---

## API

### Handlers

| Name                                               | Access | Description                     | Code                                                 |
| -------------------------------------------------- | ------ | ------------------------------- | ---------------------------------------------------- |
| [`PATCH /v1/activity/searches`](#patch-v1searches) | Public | Upsert user search selections   | [View](./src/handlers/v1/activity/searches/patch.ts) |
| [`GET /v1/activity/searches`](#patch-v1searches)   | Public | Retrieve user search selections | [View](./src/handlers/v1/activity/searches/get.ts)   |

---

## Data schema

### Search Terms

`Search.term` is currently validated as:

- The term must be a non-empty string of no more than 100 characters length
- The term must be unique on a case-insensitive basis within the collection of terms for the user.

---

## PATCH `/v1/activity/searches`

Adds a search to the existing collection. The search term is validated according to the rules for `Search Terms` above.

### Request

```json
{
  "term": "a new search term",
  "timestamp": "2026-11-03T14:20:00Z"
}
```

### Response

```json
{
  "searches": {
    "selectedSearches": [
      { "term": "search term 1", "timestamp": "2026-11-03T14:20:00Z" },
      { "term": "search term 2", "timestamp": "2026-11-04T13:45:00Z" }
    ]
  }
}
```

## GET `/v1/activity/searches`

Returns the authenticated user's searches.

### Response

```json
{
  "searches": {
    "selectedSearches": [
      { "term": "search term 1", "timestamp": "2026-11-03T14:20:00Z" },
      { "term": "search term 2", "timestamp": "2026-11-04T13:45:00Z" }
    ]
  }
}
```

> Returns empty `selectedSearches` array if the user does not exist.

---

## Related

**FLEX:**

- [@flex/sdk](/libs/sdk/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@flex/utils](/libs/utils/README.md)
- [Domain Development Guide](/docs/domain-development.md)
