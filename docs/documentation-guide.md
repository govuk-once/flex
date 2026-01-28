# Documentation Guide

Standards and templates for writing documentation in FLEX.

---

## Principles

1. **Keep READMEs lean** — Summarise what something does, link to detailed guides
2. **Use plain English** — Avoid jargon, define technical terms
3. **Show, don't tell** — Prefer code examples over lengthy explanations
4. **Be consistent** — Follow the templates below

### Code Block Conventions

- Always include a language identifier (`javascript`, `typescript`, `bash`, `json`, `text`)
- Use `text` for directory structures

### Formatting

- Use `---` dividers between major sections
- Use tables for structured data (commands, handlers, exports)
- Use blockquotes (`>`) for notes
- Use **bold** sparingly
- Prefer sentences over bullet points in prose

## Where Documentation Lives

| Content Type           | Location                   |
| ---------------------- | -------------------------- |
| What a package is for  | `libs/<package>/README.md` |
| Usage examples         | `libs/<package>/README.md` |
| Multi-step workflows   | `docs/*.md`                |
| Cross-cutting concerns | `docs/*.md`                |

---

## README Templates

### FLEX Platform SDK

All workspaces under `libs/*` use this template.

````markdown
# @flex/<package>

Brief description of what this package provides.

---

## Commands

Run these from the repository root:

| Command                              | Description |
| ------------------------------------ | ----------- |
| `pnpm --filter @flex/<package> lint` | Lint files  |
| `pnpm --filter @flex/<package> test` | Run tests   |

Alternatively, run `pnpm <command>` from within `libs/<package>/`.

## API

| Export                      | Description  | Code                  |
| --------------------------- | ------------ | --------------------- |
| [`exportName`](#exportname) | What it does | [View](./src/path.ts) |

### Types

| Export     | Description        | Code                  |
| ---------- | ------------------ | --------------------- |
| `TypeName` | What it represents | [View](./src/path.ts) |

---

## `exportName`

Brief description of what this export does.

Notes on non-obvious behaviour (throws, side effects, etc.).

### Usage

```typescript
// Focused example demonstrating typical usage
```

#### With Options

Optional subsection(s) for alternative usage patterns:

```typescript
// Example with configuration options
```

---

## Related

**FLEX:**

- [@flex/other-package](../other-package/README.md)

**External:**

- [Relevant External Docs](https://example.com)
````

---

### FLEX Platform Domain

All workspaces under `platform/domains/*` use this template.

```markdown
# @platform/<domain>

Brief description of what this platform handler does.

---

## Commands

Run these from the repository root:

| Command                                 | Description |
| --------------------------------------- | ----------- |
| `pnpm --filter @platform/<domain> lint` | Lint files  |
| `pnpm --filter @platform/<domain> test` | Run tests   |

Alternatively, run `pnpm <command>` from within `platform/domains/<domain>/`.

---

## Handler

| Property | Value                                   |
| -------- | --------------------------------------- |
| Type     | Lambda Authorizer / CloudFront Function |
| Trigger  | What triggers this handler              |

### Behaviour

Document the handler's logic:

- Success conditions
- Failure conditions
- Side effects (caching, logging, etc.)

### Configuration

> Omit this section if the handler has no configuration.

| Environment Variable | Description              |
| -------------------- | ------------------------ |
| `NAME`               | What does it refer to    |
| `NAME_PARAM_NAME`    | SSM parameter name for X |

> `getConfig` strips the `_PARAM_NAME` suffix from environment variable names, so `API_KEY_PARAM_NAME` becomes `config.API_KEY` in handler code.

---

## Related

**FLEX:**

- [@flex/handlers](../../../libs/handlers/README.md)
- [@flex/logging](../../../libs/logging/README.md)
- [@flex/middlewares](../../../libs/middlewares/README.md)
- [@flex/testing](../../../libs/testing/README.md)
- [@flex/utils](../../../libs/utils/README.md)
- [@platform/flex](../../infra/flex/README.md)

**External:**

- [Relevant External Docs](https://example.com)
```

---

### FLEX Platform Infrastructure

All workspaces under `platform/infra/*` use this template.

````markdown
```typescript

```

## Related

**FLEX:**

- [@flex/config](../../libs/config/README.md)
- [@flex/handlers](../../libs/handlers/README.md)
- [@flex/logging](../../libs/logging/README.md)
- [@flex/middlewares](../../libs/middlewares/README.md)
- [@flex/testing](../../libs/testing/README.md)
- [@flex/utils](../../libs/utils/README.md)
- [Domain Development Guide](../../docs/domain-development.md)

**External:**

- [Relevant External Doc](https://example.com)
````

---

### FLEX Domain

All workspaces under `domains/*` use this template.

````markdown
```typescript

```

## Related

**FLEX:**

- [@flex/config](../../libs/config/README.md)
- [@flex/handlers](../../libs/handlers/README.md)
- [@flex/logging](../../libs/logging/README.md)
- [@flex/middlewares](../../libs/middlewares/README.md)
- [@flex/testing](../../libs/testing/README.md)
- [@flex/utils](../../libs/utils/README.md)
- [Domain Development Guide](../../docs/domain-development.md)

**External:**

- [Relevant External Doc](https://example.com)
````

---

## Related

**The GDS Way:**

- [README Guidance](https://gds-way.digital.cabinet-office.gov.uk/manuals/readme-guidance.html)
- [Writing for GOV.UK](https://www.gov.uk/guidance/content-design/writing-for-gov-uk)
