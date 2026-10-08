---
title: Conventions
description: The rules for code, dependencies, commits, pull requests, git hooks and these docs.
---

These rules apply to every change. Work within the scope of the change you are making.

## Code

- Code is TypeScript, and packages are ES modules (`"type": "module"`). Each package extends the shared
  TypeScript, ESLint and Vitest configuration in [`@flex/config`](/flex/reference/flex-config/).
  Only add package-specific configuration when the package needs it.
- TypeScript is strict and also turns on `noUncheckedIndexedAccess`, so an indexed read may be
  `undefined`.
- ESLint runs Prettier as a rule, so formatting problems are lint errors. Imports and exports are
  sorted. Floating promises are errors. Prefix an unused variable or argument with `_`.
- Every package lints with `--max-warnings=0`. A warning fails `pnpm lint` and CI.
- Unit tests are `*.test.ts` files, usually next to the code they test, and run with Vitest. Globals are off: import
  `describe`, `expect` and `it`, or the extended `it` from
  [`@flex/testing`](/flex/reference/flex-testing/).
- Git ignores generated output, including `dist/`, `cdk.out/`, `coverage/`, `.nx/` and `.env`. Do
  not commit it.
- Never commit a secret value, such as a key, a token or a password, in code, configuration or
  these docs. Secrets live in AWS Secrets Manager. See
  [Resources](/flex/domains/resources/).
- Keep comments close to the code they explain. Explain a constraint or a decision that is not
  obvious. Do not repeat these docs in comments.

## Dependencies

- Versions are pinned exactly. `pnpm-workspace.yaml` sets `savePrefix: ""`, so `pnpm add` writes
  `1.2.3`, not `^1.2.3`.
- pnpm refuses any release less than seven days old (`minimumReleaseAge`). Dependabot waits seven
  days before it proposes an update too, and groups patch and minor updates into one weekly pull
  request.
- Only the packages listed under `allowBuilds` in `pnpm-workspace.yaml` may run install scripts.
- `overrides` in `pnpm-workspace.yaml` pins transitive dependencies, mostly to pick up security
  fixes. Remove an override once nothing needs it.
- GitHub Actions are pinned to a full commit SHA, with the version in a comment:

  ```yaml
  uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  ```

## Commits and pull requests

Pull requests are squash merged, so a pull request's title becomes the commit on `main`. That
commit decides the next release version. See [Releases](/flex/delivery/releases/).

A pull request's title is a Jira reference followed by a
[Conventional Commits](https://www.conventionalcommits.org/) header:

```text
<JIRA-REF> <type>(<scope>)?: <description>
```

```text
FLEX-123 feat: add user preferences endpoint
FLEX-456 fix(udp): handle empty payload
FLEX-789 feat!: drop legacy auth
```

- The Jira reference comes first, such as `FLEX-123` or `GOVUKAPP-4030`.
- The scope is optional, in brackets, and names the part of the code you changed.
- A `!` after the type or scope marks a breaking change.
- The description is short, starts with a lowercase letter and uses the imperative mood: "add",
  not "adds" or "added".

The type is one of these:

| Type       | Use it for                                                       |
| ---------- | ---------------------------------------------------------------- |
| `feat`     | A new feature or enhancement                                     |
| `fix`      | A bug fix                                                        |
| `perf`     | A performance improvement                                        |
| `chore`    | Changes to tooling, the build process or libraries               |
| `docs`     | Documentation only                                               |
| `style`    | Formatting that does not change behaviour                        |
| `refactor` | A change that neither fixes a bug nor adds a feature             |
| `test`     | Adding or correcting tests                                       |
| `ci`       | Changes to the GitHub workflows                                  |
| `build`    | Changes to the build system or external dependencies             |
| `revert`   | Reverting an earlier commit                                      |

The [`Validate PR Title`](https://github.com/govuk-once/flex/blob/main/.github/workflows/ci-pr-title-check.yml)
workflow fails a pull request whose title does not match, and comments with the expected format.
Dependabot's pull requests are exempt. Commit messages on your branch are not checked, but
following the same format keeps the history readable.

### Opening a pull request

1. Fill in the [pull request template](https://github.com/govuk-once/flex/blob/main/.github/PULL_REQUEST_TEMPLATE.md):
   what changed and why, a link to the Jira ticket, the type of change and how you tested it.
2. Work through its checklist before you ask for a review.
3. Keep the pull request small and focused. Split a large change into several pull requests.
4. Wait for the checks to pass. What runs on a pull request is described in
   [The pipeline](/flex/delivery/pipeline/).

`CODEOWNERS` assigns every path, including `domains/`, to `@govuk-once/govuk-once-flex-developers`,
so the Flex team reviews every pull request. For how to review, see
[The GDS Way: pull requests](https://gds-way.digital.cabinet-office.gov.uk/standards/pull-requests.html).

## Pre-commit hooks

`pre-commit install` installs hooks that run on every commit. The hooks are set in
[`.pre-commit-config.yaml`](https://github.com/govuk-once/flex/blob/main/.pre-commit-config.yaml):

| Hook                                          | What it does                                                    |
| --------------------------------------------- | --------------------------------------------------------------- |
| `end-of-file-fixer`, `trailing-whitespace`    | Fix whitespace at the ends of lines and files                   |
| `check-yaml`, `check-json`                    | Check YAML and JSON files parse                                 |
| `check-added-large-files`                     | Refuse large files                                              |
| `check-merge-conflict`, `check-case-conflict` | Refuse merge conflict markers and file names that differ only by case |
| `detect-private-key`                          | Refuse private keys                                             |
| `detect-secrets`                              | Refuse anything that looks like a secret and is not in `.secrets.baseline` |

CI runs the same hooks against every file, so a commit that skipped them still fails. To run them
yourself:

```bash
pre-commit run --all-files
```

`detect-secrets` ignores `pnpm-lock.yaml` and subresource integrity hashes. When it flags something
that is not a secret, either:

- add a `pragma: allowlist secret` comment at the end of the line, or
- update the baseline, check the new entries, and commit `.secrets.baseline`:

  ```bash
  detect-secrets scan --baseline .secrets.baseline
  detect-secrets audit .secrets.baseline
  ```

If a real secret has been committed, follow [Leaked secret](/flex/runbooks/leaked-secret/).

## Documentation

This site is the source of truth for how Flex works and the rules for changing it. Packages have no
READMEs. The root `README.md` only points here.

- Before you change an area, read its page. If your change alters what a page describes, update
  the page in the same pull request. The pull request template asks you to.
- Say a thing once. Each topic has one page that explains it. Everywhere else, link to that page
  instead of repeating it.
- Describe what the code does today. If you must mention something planned, label it as planned
  and give it no date.
- Write in plain British English, in the present tense, with short sentences. Titles and headings
  are in sentence case.
- Use tables for structured data. Give every code block a language, and use `text` for directory
  trees.
- Start internal links with the base path and end them with a slash, such as
  `/flex/domains/handlers/#error-responses`. The build fails on a link that points nowhere. Link to
  code with a full GitHub URL, such as
  `https://github.com/govuk-once/flex/blob/main/libs/sdk/src/index.ts`.
- This repository is public. Anything the code shows can be described here. Never put a secret
  value in a page.

How to run and build this site is in
[Working in the repo](/flex/start/working-in-the-repo/#the-documentation-site).
