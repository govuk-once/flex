# @flex/params

This package provides a utility for loading and validating configuration parameters from environment variables and AWS SSM Parameter Store.

Its goal is to simplify secure configuration management for Lambda and serverless projects, supporting runtime validation and automatic population of secrets or parameters.

---

## Usage

Define a Zod schema for your configuration, using the `*_PARAM_NAME` suffix for any fields that should be fetched from SSM. The utility will fetch these parameters, replace the fields, and validate the final config.

#### Example

```ts
import { z } from "zod";
import { getConfig } from "@flex/params";

const configSchema = z.object({
  DB_PASSWORD_PARAM_NAME: z.string(),
  API_KEY: z.string(),
});

const config = await getConfig(configSchema);
// config.DB_PASSWORD will be populated from SSM
```

---

## Installation

Add the package and its peer dependencies:

```json
"dependencies": {
  "@flex/params": "workspace:*",
  "@aws-lambda-powertools/parameters": "2.30.1",
  "zod": "4.3.5"
}
```

---

## Features

- Fetches SSM parameters for any config field ending with `_PARAM_NAME`
- Validates configuration using Zod schemas
- Caches configuration for performance
- Integrates with the shared logging utility

---

## Notes

- Only use the `_PARAM_NAME` suffix for fields that should be fetched from SSM.
- All other fields are loaded directly from `process.env`.
- Throws on missing or invalid parameters.
