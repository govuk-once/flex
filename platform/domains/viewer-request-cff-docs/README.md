# @platform/viewer-request-cff-docs

CloudFront Function that rewrites requests for the docs static site so directory-style paths resolve to their `index.html`.

---

## Commands

Run these from the repository root:

| Command                                                | Description    |
| ------------------------------------------------------ | -------------- |
| `pnpm --filter @platform/viewer-request-cff-docs lint` | Lint files     |
| `pnpm --filter @platform/viewer-request-cff-docs test` | Run tests      |
| `pnpm --filter @platform/viewer-request-cff-docs tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `platform/domains/viewer-request-cff-docs/`.

---

## Behaviour

| Property | Value                          |
| -------- | ------------------------------ |
| Type     | CloudFront Function            |
| Trigger  | Viewer request (before origin) |

For each configured path (currently `/docs`):

| Incoming URI  | Result                                                      |
| ------------- | ----------------------------------------------------------- |
| `/docs`       | `301` redirect to `/docs/`                                  |
| `/docs/`      | Request URI rewritten to `/docs/index.html`, then forwarded |
| Anything else | Passed through unchanged                                    |

---

## Related

**FLEX:**

- [@flex/testing](/libs/testing/README.md)
- [@platform/flex](/platform/infra/flex/README.md)
