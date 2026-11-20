# @flex/app-personalisation-domain

Manages the GOV.UK App's per-user personalisation data: selected topics and searches. Requests from the App are saved to and retrieved from UDP through the service gateway.

- **Topics:** the PATCH endpoint performs a full replacement of the `selectedTopics` array.
- **Searches:** the PATCH endpoint adds a search to the user's existing collection.
- **Local council:** handlers exist but the routes are not deployed to development, staging or production. The UDP gateway has no matching route yet. Completing it is tracked in FLEX-268 (GET), FLEX-269 (POST) and FLEX-270 (DELETE).

---

## Commands

Run these from the repository root:

| Command                                               | Description    |
| ----------------------------------------------------- | -------------- |
| `pnpm --filter @flex/app-personalisation-domain lint` | Lint files     |
| `pnpm --filter @flex/app-personalisation-domain test` | Run tests      |
| `pnpm --filter @flex/app-personalisation-domain tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `domains/app-personalisation/`.

---

## API

### Handlers

| Name                                                         | Access  | Description                           | Code                                                                     |
| ------------------------------------------------------------ | ------- | ------------------------------------- | ------------------------------------------------------------------------ |
| [`PATCH /v1/preferences/topics`](#patch-v1preferencestopics) | Public  | Upsert user topic selections          | [View](./src/handlers/v1/preferences/topics/patch.ts)                    |
| [`GET /v1/preferences/topics`](#get-v1preferencestopics)     | Public  | Retrieve user topic selections        | [View](./src/handlers/v1/preferences/topics/get.ts)                      |
| [`PATCH /v1/activity/searches`](#patch-v1activitysearches)   | Public  | Upsert user search selections         | [View](./src/handlers/v1/activity/searches/patch.ts)                     |
| [`GET /v1/activity/searches`](#get-v1activitysearches)       | Public  | Retrieve user search selections       | [View](./src/handlers/v1/activity/searches/get.ts)                       |
| `POST /v1/preferences/local-council/:id`                     | Private | Save a local authority (not deployed) | [View](./src/handlers/v1/preferences/local-council/[id]/post.private.ts) |
| `GET /v1/preferences/local-council/:id`                      | Private | Get a local authority (not deployed)  | [View](./src/handlers/v1/preferences/local-council/[id]/get.private.ts)  |

---

## Data schema

### Topic IDs

`Topic.id` is currently validated only as a non-empty string. The final ID format may change (e.g., Slug, UUID) after a discussion with domain team. Until then, do not assume or validate any specific format, and treat IDs as opaque values. The schema can be tightened in [`topic.ts`](./src/schemas/topic.ts) if necessary.

### Search terms

`Search.term` is currently validated as:

- The term must be a non-empty string of no more than 100 characters length
- The term must be unique on a case-insensitive basis within the collection of terms for the user.

---

## PATCH `/v1/preferences/topics`

Replaces the authenticated user's selected topics. An empty `selectedTopics` array clears all topics.

### Request

```json
{
  "topics": {
    "selectedTopics": [
      { "id": "topic-1", "title": "Topic One" },
      { "id": "topic-2", "title": "Topic Two" }
    ]
  }
}
```

### Response

`204 No Content`

---

## GET `/v1/preferences/topics`

Returns the authenticated user's selected topics.

### Response

```json
{
  "topics": {
    "selectedTopics": [
      { "id": "topic-1", "title": "Topic One" },
      { "id": "topic-2", "title": "Topic Two" }
    ]
  }
}
```

> Returns empty `selectedTopics` array if the user does not exist.

---

## PATCH `/v1/activity/searches`

Adds a search to the existing collection. The search term is validated according to the rules for `Search terms` above.

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

---

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

---

## Related

**FLEX:**

- [@flex/sdk](/libs/sdk/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@flex/utils](/libs/utils/README.md)
- [Domain Development Guide](/docs/domain-development.md)
