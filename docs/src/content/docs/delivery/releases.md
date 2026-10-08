---
title: Releases
description: How semantic-release versions Flex, how release notes are written, and how release and deployment notifications reach Slack.
---

Releases are automatic. Nobody tags a version by hand. On every push to `main`, the **Release** job
in the [Continuous Deployment pipeline](/flex/delivery/pipeline/) runs
[semantic-release](https://github.com/semantic-release/semantic-release) after the quality checks
and before anything deploys. The configuration is in
[`.releaserc.json`](https://github.com/govuk-once/flex/blob/main/.releaserc.json).

## Versions

semantic-release reads every commit since the last `v*` tag and picks the largest bump any of them
asks for.

| Commit | Bump | Example |
| --- | --- | --- |
| Any type with `!`, or a `BREAKING CHANGE:` footer | Major | `FLEX-789 feat!: drop legacy auth` |
| `feat` | Minor | `FLEX-123 feat: add preferences endpoint` |
| `fix`, `perf` | Patch | `FLEX-456 fix: handle empty payload` |
| `chore`, `docs`, `style`, `refactor`, `test`, `ci`, `build`, `revert` | None | `FLEX-321 chore: tidy lint config` |

Pull requests are squash merged, so the PR title is the commit that counts. Its format is set out
in [Conventions](/flex/start/conventions/). The parser accepts a Jira reference before the type, or
none, so Dependabot titles such as `chore(deps): bump the dependencies group` parse normally.

A `revert` title produces no release, although the revert still deploys. Title a revert `fix` when
it should get its own version, which makes it easy to see in Slack and on the releases page.

When the commits call for a bump, semantic-release:

1. Creates the tag `v<version>`, such as `v1.2.0`.
2. Creates a [GitHub release](https://github.com/govuk-once/flex/releases) with generated notes.
3. Sets the job outputs `released`, `version` and `type` for later jobs.
4. Posts to Slack, for major and minor releases only.

When nothing calls for a bump, there is no tag and no release, and the deploys carry on as normal.
Release jobs from different runs never overlap: they share a concurrency group.

No `CHANGELOG.md` is committed and no version is written to `package.json`. Tags and GitHub
releases are the record.

A release means the code is merged and tagged, not deployed. The tag is created before the
development deploy and the approval gates, so a release can exist for code that never reaches
production.

## Release notes

Release notes are generated from the commit subjects since the previous release, with the
`conventionalcommits` preset. They have sections for breaking changes, Features, Bug Fixes,
Performance Improvements and Reverts. Other types are left out. Pull request numbers in the
subjects become links, and the Jira reference is in the subject.

## Slack notifications

All Flex delivery messages go to the same Slack channels.

| Message | When | Title |
| --- | --- | --- |
| Release | A major or minor release | `Flex <type> release: v<version>` |
| Deployment | Staging or production deployed | `Flex deployed: v<version> to <environment>` |
| Deployment failure | Any deploy job failed, in any environment | `Flex deployment failed: v<version> to <environment>` |

A release message carries the release notes, converted to Slack formatting by
[`scripts/buildReleaseNotification.ts`](https://github.com/govuk-once/flex/blob/main/scripts/buildReleaseNotification.ts)
and cut to 1,500 characters, followed by a link to the GitHub release. Patch releases are tagged
but not announced.

The quality checks also post a Macie coverage notice here. See
[Security scanning](/flex/delivery/security-scanning/#macie-coverage).

### Deployment notifications

`_notify-deployment.yml` sends the deployment and failure messages. A failure message links to the
workflow run. Successful development deploys are not announced.

Deployment messages are sent for every staging and production deploy, not only for major and minor
releases. The version is the one the run released. If the run released nothing, it is the latest
tag, and if there is no tag, the short commit hash.

### How messages reach Slack

```text
GitHub Actions job ──► SNS topic flex-release-notifications ──► Amazon Q Developer ──► Slack channels
                       (development account)                    (one channel configuration per channel)
```

1. The job assumes the development deployment role, whichever environment it is reporting on.
2. It reads the topic ARN from the SSM parameter `/development/flex/topic/release-notifications`.
3. It publishes an Amazon Q custom notification to the topic. Amazon Q renders a `custom` payload
   as written, rather than parsing it as an AWS event:

   ```json
   {
     "version": "1.0",
     "source": "custom",
     "content": {
       "textType": "client-markdown",
       "title": "Flex deployed: v1.2.0 to staging",
       "description": "Version *v1.2.0* has been deployed to *staging*."
     }
   }
   ```

The topic and the Amazon Q channel configurations are created by the core stack in the development
environment only. The channels are listed, comma-separated, in the SSM parameter
`/development/flex-param/monitoring/releaseSlackChannelId`. The core stack reads that parameter
when it is synthesised and creates one channel configuration per channel ID. To add or remove a
channel, change the parameter. The change takes effect at the next development deploy.

A channel only receives messages once the Amazon Q app is in it: invite it with `/invite @Amazon Q`.

Every credential and publish step is `continue-on-error`. A notification that fails to send never
fails or blocks a deployment.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| A merge produced no tag or release | No `feat`, `fix`, `perf` or breaking commit since the last tag. This is expected |
| The Release job failed | Read the semantic-release log in the job. Nothing deploys until it passes |
| No Slack message for a release | Patch releases are silent. For a major or minor release, read the Notify Slack step |
| No Slack message for a deployment | Read the Publish deployment notification step in the notify job |
| The wrong bump for a breaking change | The `!` must follow the type or scope, as in `feat!:` or `feat(udp)!:`, or the body needs a `BREAKING CHANGE:` footer |
| A new channel gets nothing | The development core stack has not been deployed since the parameter changed, or the Amazon Q app is not in the channel |
