# Contributing to FLEX (Federated Logic and Events eXchange System)

This document describes the process of contributing to FLEX.

## Domain and platform work

FLEX is split into domain work and platform work:

|                | Domain work                                                                                                                                   | Platform work                                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| What it is     | Application code for a single domain: its `domain.config.ts`, route handlers and tests                                                        | Anything that changes what FLEX provides or how it is deployed: infrastructure, shared libraries, service gateways, authentication, CI and docs |
| Where it lives | `domains/<name>/`, including the domain's own E2E tests                                                                                       | `libs/`, `platform/`, `tests/`, `scripts/`, `docs/`, `.github/` and repo root config                                                            |
| Who does it    | Any domain developer                                                                                                                          | [FLEX platform team](https://github.com/orgs/govuk-once/teams/govuk-once-flex-platform-developers)                                              |
| Guide          | [Domain Development Guide](/docs/domain-development.md) and [FLEX capabilities for domain developers](/docs/domain-developer-capabilities.md) | [Platform Development Guide](/docs/platform-development.md)                                                                                     |

If a change touches both, it should be split into separate PRs if possible, so a domain change is not held up by platform review.

Which paths are 'platform' and which are 'domain' is defined in [CODEOWNERS](/.github/CODEOWNERS), where each section is labelled.

Platform paths are owned by `@govuk-once/govuk-once-flex-platform-developers`, so platform changes need review from that team. Domain paths are owned by `@govuk-once/govuk-once-flex-developers` (plus the domain's own team as domains onboard), so a domain-only PR does not need platform team review.

### Need platform work done?

If your domain needs something that is not in `domains/` (a new external partner or service gateway, a change to a shared library, new infrastructure, a platform capability that does not exist yet), raise it with the FLEX platform team rather than making the change yourself:

- Ask in Slack: [#govuk-connect-flex](https://gds.slack.com/archives/C09H3EPRQJJ). Contacts: Jason Hooper (Delivery Manager), Richard Dunn (Product Owner)
- Track the request on the Jira board: [FLEX Jira board](https://gdsgovukagents.atlassian.net/jira/software/c/projects/FLEX/boards/67)

Raise it early, as platform work is often on the critical path for a domain. See [Current limits](/docs/domain-developer-capabilities.md#current-limits) for known gaps.

## Commit Message Guidelines

We use the Conventional Commits specification.

This ensures our commit history is clean, readable, and allows for automated changelog generation and version bumping.

Every commit message must be structured as follows:

```txt
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Key Rules

1. Type is Mandatory: Must be one of the types listed below.

2. Scope is Optional: Use it to specify what part of the code is being changed (e.g., typescript, terraform, ci).

3. Description: Must be short (max 50 characters), start with a lowercase letter, and written in the imperative mood (e.g., "Add," not "Adds" or "Added").

### Approved Types

| Type     | Description                                                                          |
| -------- | ------------------------------------------------------------------------------------ |
| feat     | A new feature or enhancement (results in a MINOR version change).                    |
| fix      | A bug fix (results in a PATCH version change).                                       |
| perf     | A performance improvement (results in a PATCH version change).                       |
| chore    | Changes to the build process, auxiliary tools, or libraries.                         |
| docs     | Documentation-only changes.                                                          |
| style    | Formatting fixes (e.g., whitespace, semicolons, etc., that don't affect code logic). |
| refactor | A code change that neither fixes a bug nor adds a feature.                           |
| test     | Adding missing tests or correcting existing tests.                                   |
| ci       | Changes to CI/CD pipelines and workflows.                                            |
| build    | Changes that affect the build system or external dependencies.                       |
| revert   | Reverts a previous commit.                                                           |

A `!` after the type or scope (e.g., `feat!:`), or a `BREAKING CHANGE:` footer, marks a breaking change and results in a MAJOR version change. See the [Releases and Versioning guide](/docs/releases.md) for how versions and release notes are generated.

### Example Commit

```txt
feat(typescript): Implement base handler for lambda function

This commit sets up the initial event handler structure and integrates basic error handling for AWS Lambda cold starts.

Closes #42
BREAKING CHANGE: The old request structure is no longer supported.
```

## Pull Request Guidelines

When opening a pull request:

1. Use the [pull request template](/.github/PULL_REQUEST_TEMPLATE.md) provided
2. Ensure the PR title is the Jira reference followed by the commit message format above, e.g. `FLEX-123 feat: add user preferences endpoint`. PRs are squash merged, so the title becomes the commit on `main` and determines the next release version. If there is no Jira ticket, use `FLEX-000`
3. Link to the related JIRA ticket in the description
4. Complete all checklist items before requesting review
5. Keep PRs small and focused, where large changes should be broken into smaller PRs

For more details on the review process, see [The GDS Way: Pull requests](https://gds-way.digital.cabinet-office.gov.uk/standards/pull-requests.html).

## Documentation

When adding or updating documentation, follow the [Documentation Guide](/docs/documentation-guide.md) for standards and templates.
