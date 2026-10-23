---
title: Conventions
description: What the repository enforces, where each rule is configured, and the rules that tooling can't express.
sidebar:
  order: 3
---

Most conventions are enforced by tooling. This page says where each one is set, so you can read the source of truth. It documents only the rules that tooling can't express.

For commit messages, pull request titles and the review process, see [`CONTRIBUTING.md`](https://github.com/govuk-once/flex/blob/main/.github/CONTRIBUTING.md).

## What the repository enforces

| Area                    | Where it's set                                                                                                  | Notes                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| TypeScript              | [`libs/config/src/tsconfig.json`](https://github.com/govuk-once/flex/blob/main/libs/config/src/tsconfig.json)   | Packages extend `@flex/config/tsconfig.json`.                                                               |
| Linting and formatting  | [`libs/config/src/eslint.mjs`](https://github.com/govuk-once/flex/blob/main/libs/config/src/eslint.mjs)         | Prettier runs as an ESLint rule. Each package's `lint` script uses `--max-warnings=0`, so warnings fail CI. |
| Unit tests              | [`libs/config/src/vitest.ts`](https://github.com/govuk-once/flex/blob/main/libs/config/src/vitest.ts)           | See [Testing](/flex/domains/testing/).                                                                      |
| Package-specific config | The package's own config file                                                                                   | Only add this when the package needs it, and extend the shared base.                                        |
| Git hooks               | [`.pre-commit-config.yaml`](https://github.com/govuk-once/flex/blob/main/.pre-commit-config.yaml)               | CI runs the same hooks on every file.                                                                       |
| Secret detection        | [`.secrets.baseline`](https://github.com/govuk-once/flex/blob/main/.secrets.baseline)                           | See [Leaked secret](/flex/operations/leaked-secret/) if one is committed.                                   |
| Ignored files           | [`.gitignore`](https://github.com/govuk-once/flex/blob/main/.gitignore)                                         | Don't commit generated output or `.env`.                                                                    |
| Dependency versions     | [`pnpm-workspace.yaml`](https://github.com/govuk-once/flex/blob/main/pnpm-workspace.yaml)                       | `savePrefix`, `minimumReleaseAge`, `overrides` and `allowBuilds`.                                           |
| Dependency updates      | [`.github/dependabot.yml`](https://github.com/govuk-once/flex/blob/main/.github/dependabot.yml)                 |                                                                                                             |
| Pull request title      | [`ci-pr-title-check.yml`](https://github.com/govuk-once/flex/blob/main/.github/workflows/ci-pr-title-check.yml) | The format is in `CONTRIBUTING.md`.                                                                         |
| Code review             | [`CODEOWNERS`](https://github.com/govuk-once/flex/blob/main/.github/CODEOWNERS)                                 |                                                                                                             |

## Rules tooling can't express

### Dependencies

- Pin dependency versions exactly. Don't add `^` or `~`.
- A package can only run install scripts if it's listed under `allowBuilds`. Add one deliberately.
- Remove an entry from `overrides` once nothing needs it.
- A release less than seven days old is refused on purpose. Pin an older version.
- Pin GitHub Actions to a full commit SHA, with the version in a comment, for example `uses: actions/checkout@<sha> # v7.0.1`.

### Secrets

Never commit a secret value (a key, token or password) in code, configuration or docs. See [Secrets lifecycle](/flex/security/secrets-lifecycle/).

### Comments

Keep comments close to the code they explain. Explain a constraint or a decision that isn't obvious. Don't repeat these docs in comments.

### Documentation

See [Contributing to the docs](/flex/reference/contributing-to-docs/).
