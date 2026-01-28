# Contributing to FLEX (Federated Logic and Events eXchange System)

This document describes the process of contributing to FLEX.

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
| chore    | Changes to the build process, auxiliary tools, or libraries.                         |
| docs     | Documentation-only changes.                                                          |
| style    | Formatting fixes (e.g., whitespace, semicolons, etc., that don't affect code logic). |
| refactor | A code change that neither fixes a bug nor adds a feature.                           |
| test     | Adding missing tests or correcting existing tests.                                   |

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
2. Ensure the PR title follows the commit message format above
3. Link to the related JIRA ticket in the description
4. Complete all checklist items before requesting review
5. Keep PRs small and focused, where large changes should be broken into smaller PRs

For more details on the review process, see [The GDS Way: Pull requests](https://gds-way.digital.cabinet-office.gov.uk/standards/pull-requests.html).

## Documentation

When adding or updating documentation, follow the [Documentation Guide](/docs/documentation-guide.md) for standards and templates.
