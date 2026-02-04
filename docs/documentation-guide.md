# Documentation Guide

Standards and templates for writing documentation in FLEX.

---

## Principles

1. **Keep READMEs lean**: Summarise what something does, link to detailed guides
2. **Use plain English**: Avoid jargon, define technical terms
3. **Show, don't tell**: Prefer code examples over lengthy explanations
4. **Be consistent**: Follow the templates below

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

| Content Type                                 | Location                                                     |
| -------------------------------------------- | ------------------------------------------------------------ |
| What a package is for with usage examples    | `libs/*/README.md`                                           |
| What a domain is for with usage examples     | `domains/*/README.md`                                        |
| Platform infrastructure with usage examples  | `platform/domains/*/README.md`, `platform/infra/*/README.md` |
| Multi-step workflows, cross-cutting concerns | `docs/*.md`                                                  |

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

| Command                              | Description    |
| ------------------------------------ | -------------- |
| `pnpm --filter @flex/<package> lint` | Lint files     |
| `pnpm --filter @flex/<package> test` | Run tests      |
| `pnpm --filter @flex/<package> tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `libs/<package>/`.

## API

| Name                        | Description  | Code                  |
| --------------------------- | ------------ | --------------------- |
| [`exportName`](#exportname) | What it does | [View](./src/path.ts) |

### Types

| Name       | Description        | Code                  |
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

- [@flex/<package>](/libs/<package>/README.md)

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

| Command                                 | Description    |
| --------------------------------------- | -------------- |
| `pnpm --filter @platform/<domain> lint` | Lint files     |
| `pnpm --filter @platform/<domain> test` | Run tests      |
| `pnpm --filter @platform/<domain> tsc`  | Run type check |

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

- [@flex/handlers](/libs/handlers/README.md)
- [@flex/logging](/libs/logging/README.md)
- [@flex/middlewares](/libs/middlewares/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@flex/utils](/libs/utils/README.md)
- [@platform/flex](/platform/infra/flex/README.md)

**External:**

- [Relevant External Docs](https://example.com)
```

---

### FLEX Platform Infrastructure

All workspaces under `platform/infra/*` use this template.

````markdown
# @platform/<package>

Brief description of what this infrastructure provides.

---

## Commands

Run these from the repository root:

| Command                                     | Description                 |
| ------------------------------------------- | --------------------------- |
| `pnpm --filter @platform/<package> lint`    | Lint files                  |
| `pnpm --filter @platform/<package> checkov` | Run Checkov security scan   |
| `pnpm --filter @platform/<package> deploy`  | Deploy stack                |
| `pnpm --filter @platform/<package> destroy` | Destroy stack               |
| `pnpm --filter @platform/<package> diff`    | Show deployment differences |
| `pnpm --filter @platform/<package> synth`   | Synthesise CloudFormation   |
| `pnpm --filter @platform/<package> tsc`     | Run type check              |

> Alternatively, run `pnpm <command>` from within `platform/infra/<package>/`.

## Scripts

> Omit if no scripts exist.

| Name                        | Description          | Code                        |
| --------------------------- | -------------------- | --------------------------- |
| [`scriptName`](#scriptname) | What the script does | [View](./scripts/<name>.sh) |

### `scriptName`

[Brief description of what the script does]

---

## API

| Name                        | Description  | Code                   |
| --------------------------- | ------------ | ---------------------- |
| [`exportName`](#exportname) | What it does | [View](./src/index.ts) |

### Outputs

Available exports via `@platform/<package>/<path>`.

| Name         | Description                 | Code                  |
| ------------ | --------------------------- | --------------------- |
| `outputName` | Brief description of output | [View](./src/path.ts) |

### Types

| Name       | Description        | Code                  |
| ---------- | ------------------ | --------------------- |
| `TypeName` | What it represents | [View](./src/path.ts) |

> See [Constructs](#constructs) for Lambda function constructs.
> See [Utilities](#utilities) for common utilities and helpers.

---

## `exportName`

[Brief description of export]

### Usage

```typescript
// Example usage
```

<!-- FOR STACKS (like core, flex): Include the `Stack` section -->

## Stack

[Brief description of the stack and what it deploys/outputs]

### Resources

| Resource       | Description        | Code                  |
| -------------- | ------------------ | --------------------- |
| `ResourceName` | What it is and why | [View](./src/path.ts) |

### SSM Outputs

> Omit if no SSM exports.

| Output       | SSM Path             | Description        | Code                  |
| ------------ | -------------------- | ------------------ | --------------------- |
| `OutputName` | `/{env}/<name>/path` | What it's used for | [View](./src/path.ts) |

<!-- FOR STACKS WITH CONSTRUCTS (like flex): Add `Constructs` section -->

## Constructs

| Name            | Description              | Code                               |
| --------------- | ------------------------ | ---------------------------------- |
| `ConstructName` | What this construct does | [View](./src/constructs/<name>.ts) |

### `ConstructName`

[Brief description of the construct]

```typescript
// Usage example
```

<!-- FOR STACKS WITH UTILITIES (like flex): Add `Utilities` section -->

## Utilities

| Name                          | Description            | Code                          |
| ----------------------------- | ---------------------- | ----------------------------- |
| [`utilityName`](#utilityname) | What this utility does | [View](./src/utils/<name>.ts) |

### `utilityName`

[Brief description of the utility]

```typescript
// Usage example
```

---

## Related

**FLEX:**

- [@flex/<package>](/libs/<package>/README.md)
- [@platform/<name>](/platform/infra/<name>/README.md)
- [Platform Development Guide](/docs/platform-development.md)

**External:**

- [Relevant External Docs](https://example.com)
````

---

### FLEX Domain

All workspaces under `domains/*` use this template.

````markdown
# @flex/<domain>-domain

Brief description of the domain.

---

## Commands

Run these from the repository root:

| Command                                    | Description    |
| ------------------------------------------ | -------------- |
| `pnpm --filter @flex/<domain>-domain lint` | Lint files     |
| `pnpm --filter @flex/<domain>-domain test` | Run tests      |
| `pnpm --filter @flex/<domain>-domain tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `domains/<domain>/`.

---

## API

### Handlers

| Name                           | Access                                     | Description            | Code                                  |
| ------------------------------ | ------------------------------------------ | ---------------------- | ------------------------------------- |
| [`METHOD /path`](#method-path) | Public / Private Egress / Private Isolated | What this handler does | [View](./src/handlers/path/method.ts) |

### Services

> Omit this section if the domain has no internal services.

| Name                          | Description            | Code                             |
| ----------------------------- | ---------------------- | -------------------------------- |
| [`serviceName`](#servicename) | What this service does | [View](./src/service/service.ts) |

---

## METHOD `/path`

Brief description of what this handler does.

### Configuration

> Omit this section if the handler has no configuration.

| Environment Variable | Description                   |
| -------------------- | ----------------------------- |
| `VAR_NAME`           | What this variable configures |

### Request

> Omit this section for GET/DELETE handlers.

```json
{
  "field": "value"
}
```

### Response

```json
{
  "field": "value"
}
```

### Middlewares

> Omit this section if handler uses no custom middlewares.

- `middlewareName`: what it does

---

## `serviceName`

> Omit this section if the domain has no internal services.

Brief description of what this service does.

```typescript
// Usage example
```

---

## Related

**FLEX:**

- [@flex/config](/libs/config/README.md)
- [@flex/handlers](/libs/handlers/README.md)
- [@flex/logging](/libs/logging/README.md)
- [@flex/middlewares](/libs/middlewares/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@flex/utils](/libs/utils/README.md)
- [Domain Development Guide](/docs/domain-development.md)

**External:**

- [Relevant External Doc](https://example.com)
````

---

## Related

**The GDS Way:**

- [README Guidance](https://gds-way.digital.cabinet-office.gov.uk/manuals/readme-guidance.html)
- [Writing for GOV.UK](https://www.gov.uk/guidance/content-design/writing-for-gov-uk)
