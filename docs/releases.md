# Releases and Versioning

This guide describes how release versions are created, how release notes are generated, and when Slack notifications are sent. Releases are fully automated with [semantic-release](https://github.com/semantic-release/semantic-release); no manual tagging is required or expected.

---

## How Versioning Is Determined

On every push to `main`, the `Release` job in the [Continuous Deployment pipeline](/.github/workflows/main.yml) runs semantic-release before anything is deployed. It analyses every commit since the last release tag and calculates the next semantic version:

| Commit type                                  | Version bump          | Example                                   |
| -------------------------------------------- | --------------------- | ----------------------------------------- |
| `feat`                                       | Minor (`1.2.0`)       | `FLEX-123 feat: add preferences endpoint` |
| `fix`, `perf`                                | Patch (`1.1.1`)       | `FLEX-456 fix: handle empty payload`      |
| Any type with `!` or a `BREAKING CHANGE:` footer | Major (`2.0.0`)   | `FLEX-789 feat!: drop legacy auth`        |
| `chore`, `docs`, `style`, `refactor`, `test`, `ci`, `build`, `revert` | None | `FLEX-321 chore: tidy lint config`  |

When the analysed commits produce a version bump, the pipeline:

1. Creates the git tag `v<version>` (for example `v1.2.0`)
2. Creates a GitHub release with generated release notes
3. Exposes `version`, `type` and `released` as job outputs for later pipeline steps
4. Sends a Slack notification for major and minor releases

When no commit since the last tag warrants a release, no tag or GitHub release is created and the deployment continues as normal.

A GitHub release means the code is merged and tagged. It does not mean the code has been deployed; releases are created before the development deployment and the manual approval gates, so a release can exist for code that has not yet reached production.

---

## Commit Message Format

Pull requests are squash merged, so the PR title becomes the commit message on `main` and drives versioning. Titles are validated by [`ci-pr-title-check.yml`](/.github/workflows/ci-pr-title-check.yml) and must follow:

```txt
<JIRA-REF> <type>(<scope>)?: <description>
```

Examples:

```txt
FLEX-123 feat: add user preferences endpoint
FLEX-456 fix(udp): handle empty payload
FLEX-789 feat!: drop legacy auth
GOVUKAPP-3392 chore: update WAF rules
```

Notes:

- The Jira reference comes first, then a [Conventional Commits](https://www.conventionalcommits.org/) type. See [CONTRIBUTING.md](/.github/CONTRIBUTING.md) for the approved types.
- Breaking changes are flagged with `!` after the type or scope, or with a `BREAKING CHANGE:` footer in the squashed commit body. Either produces a major release.
- Dependabot PR titles (for example `chore(deps): bump the dependencies group`) have no Jira reference and are parsed as ordinary conventional commits.
- Commits that predate this convention contribute nothing to version calculation, which is harmless.

---

## How Release Notes Are Generated

Release notes are generated from the commit subjects since the previous release, grouped by type (Features, Bug Fixes, and so on) using the `conventionalcommits` preset. They are published on the [GitHub release](https://github.com/govuk-once/flex/releases). PR numbers in squash commit subjects are linked automatically, and the Jira reference is available via the linked PR.

The configuration lives in [`.releaserc.json`](/.releaserc.json). No CHANGELOG.md is committed and no version is written back to `package.json`; tags and GitHub releases are the source of truth.

---

## Slack Notifications

The `#govuk-once-flex-release` channel is notified for **major and minor** releases only. Patch releases are still tagged and released on GitHub but are deliberately silent.

The notification contains the version, the release type, a summary of the release notes and a link to the GitHub release. Delivery reuses the existing AWS Chatbot (Amazon Q) mechanism used for alerts: the pipeline publishes a message to the `flex-release-notifications` SNS topic in the development account, which AWS Chatbot forwards to Slack. The topic and channel configuration are defined in the [core stack](/platform/infra/flex/src/stacks/core/stack.ts) and only exist in the development environment.

A failed Slack notification never blocks deployment (the step is `continue-on-error`).

---

## Troubleshooting

| Symptom                                   | Likely cause                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| Merge produced no tag or release          | No `feat`/`fix`/`perf`/breaking commits since the last tag; this is expected  |
| Release job failed                        | Check the semantic-release log in the job output; deployment is blocked until fixed |
| No Slack message for a release            | Patch releases are silent by design; for major/minor, check the Notify Slack step |
| Wrong bump for a breaking change          | Ensure `!` follows the type/scope (`feat!:`) or the body has a `BREAKING CHANGE:` footer |
