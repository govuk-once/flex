## Contributing to the Business Layer Platform

Thank you for contributing. This guide explains how to propose changes and what to expect.

## Ways to contribute

- Raise issues with clear problem statements and context
- Improve documentation and examples
- Submit pull requests (PRs) for code, tests, and docs
- Write RFCs for cross-cutting or breaking changes

## Workflow

1. For substantial changes, open a brief proposal issue to gather feedback
2. If the change is cross-cutting or breaking, create an RFC using `docs/rfcs/0000-template.md`
3. Open a PR early as draft to get review feedback
4. Ensure CI is green (tests, lint, security checks)
5. Request reviews from relevant CODEOWNERS

Merge requirements

- 2 approvals
- Green CI
- CODEOWNERS approval for owned areas

Review SLO

- First response within 2 business days
- Aim to merge within 5 business days unless RFC required

## When to write an RFC vs ADR

- RFC: broad impact, new canonical models, architectural patterns, or breaking changes
- ADR: local technical decisions within a single area/repo section

## Coding standards

- Follow repository linters and formatters
- Add/maintain tests; prefer small, deterministic tests
- Document public APIs and domain models

## Branching and releases

- Prefer trunk-based development with small PRs
- Use feature flags for risky changes
- Releases follow SemVer; see `RELEASE.md`

## Security and privacy

- Do not commit secrets or personal data
- Report vulnerabilities as described in `SECURITY.md`

## Code of Conduct

- By participating, you agree to the Contributor Covenant in `CODE_OF_CONDUCT.md`


