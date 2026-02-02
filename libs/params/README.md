# @flex/params

Configuration utility for loading/validating environment variables and resolving SSM parameter references.

---

## Commands

Run these from the repository root:

| Command                           | Description    |
| --------------------------------- | -------------- |
| `pnpm --filter @flex/params lint` | Lint files     |
| `pnpm --filter @flex/params test` | Run tests      |
| `pnpm --filter @flex/params tsc`  | Run type check |

Alternatively, run `pnpm <command>` from within `libs/params/`.

---

## API

| Name                      | Description                                                 | Code                   |
| ------------------------- | ----------------------------------------------------------- | ---------------------- |
| [`getConfig`](#getconfig) | Validates environment variables and resolves SSM parameters | [View](./src/index.ts) |

---

## `getConfig`

Retrieves configuration by validating `process.env` against a Zod schema and resolving any SSM parameter references. Results are cached per schema.

Environment variables ending in `_PARAM_NAME` are treated as SSM parameter paths. The suffix is stripped from the returned configuration keys.

### Usage

```typescript
import { getConfig } from "@flex/params";
import { z } from "zod";

const ConfigSchema = z.object({
  LOG_LEVEL: z.string(),
  SOME_EXAMPLE_PARAM_NAME: z.string(),
});

const config = await getConfig(ConfigSchema);
// { LOG_LEVEL: "INFO", SOME_EXAMPLE: "resolved-value-from-ssm" }
```

### Parameter Resolution

| Environment Variable   | Value (SSM Path)             | Config Key  |
| ---------------------- | ---------------------------- | ----------- |
| `SOME_VAR_PARAM_NAME`  | `/dev/flex-param/api-key`    | `SOME_VAR`  |
| `OTHER_VAR_PARAM_NAME` | `/dev/flex-secret/my-secret` | `OTHER_VAR` |

> The environment variable's value is treated as an SSM parameter path. The suffix `_PARAM_NAME` is stripped from the returned config key.

### Errors

- Throws if schema validation fails
- Throws if SSM parameter is not found or not a string

---

## Related

**FLEX:**

- [@flex/logging](/libs/logging/README.md)
- [@flex/utils](/libs/utils/README.md)
- [Domain Development Guide](/docs/domain-development.md)

**External:**

- [AWS Lambda Powertools Parameters](https://docs.aws.amazon.com/powertools/typescript/latest/features/parameters/)
