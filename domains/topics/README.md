# @flex/topics-domain

Manages user topic selections. Users can update their selected topics via the PATCH endpoint, which performs a full replacement of the `selectedTopics` array through the UDP gateway.

---

## Commands

Run these from the repository root:

| Command                                  | Description    |
| ---------------------------------------- | -------------- |
| `pnpm --filter @flex/topics-domain lint` | Lint files     |
| `pnpm --filter @flex/topics-domain test` | Run tests      |
| `pnpm --filter @flex/topics-domain tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `domains/topics/`.

---

## API

### Handlers

| Name                                  | Access | Description                  | Code                                      |
| ------------------------------------- | ------ | ---------------------------- | ----------------------------------------- |
| [`PATCH /v1/topics`](#patch-v1topics) | Public | Upsert user topic selections | [View](./src/handlers/v1/topics/patch.ts) |

---

## PATCH `/v1/topics`

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

## Related

**FLEX:**

- [@flex/sdk](/libs/sdk/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@flex/utils](/libs/utils/README.md)
- [Domain Development Guide](/docs/domain-development.md)
