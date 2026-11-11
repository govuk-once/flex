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

| Name                                               | Access | Description                   | Code                                                 |
| -------------------------------------------------- | ------ | ----------------------------- | ---------------------------------------------------- |
| [`PATCH /v1/activity/searches`](#patch-v1searches) | Public | Upsert user search selections | [View](./src/handlers/v1/activity/searches/patch.ts) |

---
