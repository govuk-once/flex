# @flex/personalisation-domain

Manages per-user personalisation data for Flex consumers. Requests are saved to and retrieved from UDP through the service gateway.

---

## Commands

Run these from the repository root:

| Command                                           | Description    |
| ------------------------------------------------- | -------------- |
| `pnpm --filter @flex/personalisation-domain lint` | Lint files     |
| `pnpm --filter @flex/personalisation-domain test` | Run tests      |
| `pnpm --filter @flex/personalisation-domain tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `domains/personalisation/`.

---

## API

### Preferences

Settings a user chooses.

| Name                                                         | Access  | Description                           | Code                                                                     |
| ------------------------------------------------------------ | ------- | ------------------------------------- | ------------------------------------------------------------------------ |
| [`PATCH /v1/preferences/topics`](#patch-v1preferencestopics) | Public  | Replace user topic selections         | [View](./src/handlers/v1/preferences/topics/patch.ts)                    |
| [`GET /v1/preferences/topics`](#get-v1preferencestopics)     | Public  | Retrieve user topic selections        | [View](./src/handlers/v1/preferences/topics/get.ts)                      |
| `POST /v1/preferences/local-council/:id`                     | Private | Save a local authority (not deployed) | [View](./src/handlers/v1/preferences/local-council/[id]/post.private.ts) |
| `GET /v1/preferences/local-council/:id`                      | Private | Get a local authority (not deployed)  | [View](./src/handlers/v1/preferences/local-council/[id]/get.private.ts)  |

The local council routes are not deployed to development, staging or production because the UDP gateway has no matching route yet. Completing them is tracked in FLEX-268 (GET), FLEX-269 (POST) and FLEX-270 (DELETE).

### Activity

Data recorded from what a user does.

| Name                                                       | Access | Description                                          | Code                                                         |
| ---------------------------------------------------------- | ------ | ---------------------------------------------------- | ------------------------------------------------------------ |
| [`PATCH /v1/activity/searches`](#patch-v1activitysearches) | Public | Add a search to the user's collection                | [View](./src/handlers/v1/activity/searches/patch.ts)         |
| [`GET /v1/activity/searches`](#get-v1activitysearches)     | Public | Retrieve user searches                               | [View](./src/handlers/v1/activity/searches/get.ts)           |
| [`DELETE /v1/activity/searches`](#patch-v1searches)        | Public | Delete all searches from the user's collection       | [View](./src/handlers/v1/activity/searches/delete.ts)        |
| [`DELETE /v1/activity/searches/:term`](#patch-v1searches)  | Public | Delete a specified search from the user's collection | [View](./src/handlers/v1/activity/searches/[term]/delete.ts) |

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

Adds a search to the existing collection. The search term is validated according to the rules for `Search Terms` above.

### Request

```json
{
  "term": "a new search term",
  "timestamp": "2026-11-03T14:20:00Z"
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

## DELETE `/v1/activity/searches`

Delete all the authenticated user's searches from their collection.

## DELETE `/v1/activity/searches/:term`

Delete a specified search from the authenticated user's collection.

### Path Parameter

```json
{ "term": "a user search term" }
```

---

## Related

**FLEX:**

- [@flex/sdk](/libs/sdk/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@flex/utils](/libs/utils/README.md)
- [Domain Development Guide](/docs/domain-development.md)
