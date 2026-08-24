# Leaked Secret Runbook

How to respond when a secret (an API key, credential, token, private key or signing key) has been exposed on the AWS FLEX platform.

This runbook is for the engineer who has found, or been told about, a leaked secret. It assumes no prior incident experience. A leaked secret is a live security risk from the moment it is exposed, so read the priority note, then work straight through the numbered steps. The order matters: contain the exposure before you investigate it.

> Treat every suspected leak as a real one until proven otherwise. Revoking a secret that turned out to be safe costs a few minutes; leaving a genuinely exposed secret live can cost far more. When in doubt, revoke.

---

## The Wider Incident Process

A leaked secret is one type of technical incident. This runbook covers only the secret-specific steps. For the general process that applies to any incident (roles, severities, communication and escalation), follow the central guidance, which is maintained and updated regularly:

- [GDS Way: how to manage technical incidents](https://gds-way.digital.cabinet-office.gov.uk/standards/incident-management.html#how-to-manage-technical-incidents)
- [GOF: Incident Process](https://gdsgovukagents.atlassian.net/wiki/spaces/GOF/pages/79495229/Incident+Process) (Confluence)

Treat those as the source of truth and defer to them over anything here. The sections below assume that process and add only what is specific to a leaked secret, where the overriding rule is to revoke first (see the priority note above).

---

## Getting required access privilidges

Get in touch with with Stephen Ford (stephen.ford@digital.cabinet-office.gov.uk) from Platform Team to receive required privlidges temporarely to carry out required operations.

---

## What Counts as a Leaked Secret

A secret is leaked the moment it becomes readable by anyone who should not have it. Common exposure routes on FLEX are a value committed to git, pasted into a pull request, ticket, Slack message or screenshot, printed into a log or error, or returned in an API response.

FLEX runs several layers specifically to stop secrets escaping. A leak means one of them was bypassed, so knowing which layer failed also tells you where to add prevention afterwards:

| Layer          | Mechanism                                                                                                | What it should have caught                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Pre-commit     | [`detect-secrets`](/.pre-commit-config.yaml) against `.secrets.baseline`, plus `detect-private-key`      | A secret being committed locally                                                            |
| Quality Checks | The Security job runs `pre-commit run --all-files`, SonarQube and checkov                                | A secret reaching a pull request or `main`                                                  |
| Log redaction  | The sanitiser ([`libs/logging/src/sanitizer.ts`](/libs/logging/src/sanitizer.ts)) and `addSecretValue()` | A secret being written to CloudWatch, see the [Log Redaction guide](/docs/log-redaction.md) |

The layer that failed does not change your immediate response. Contain first; record the failed control for the follow-up.

On FLEX, the actual value of any secret the platform stores lives in **AWS Secrets Manager** and nowhere else (the `secret` type). A service reads it at runtime via Middy, which attaches the value to the Lambda context; the environment variable holds only the secret's name, never its value. A third-party credential FLEX needs is stored the same way.

| Type                  | What it holds                                                                      | Notes                                                        |
| --------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `secret`              | The secret value, in AWS Secrets Manager                                           | The only place a real secret value lives; fetched at runtime |
| `ssm` / `ssm:runtime` | Non-secret configuration strings in SSM Parameter Store, for example a gateway URL | Not secrets                                                  |
| `kms`                 | An encryption key held in AWS KMS; services receive only the key ARN               | Key material never leaves KMS                                |
| CI/CD                 | Deployment role ARNs in GitHub Actions secrets, for example `ROLE_TO_ASSUME`       | References, not credential material                          |

The runtime versus deploy-time split ([`resolve-config.ts`](/libs/sdk/src/route/resolve-config.ts)) still matters before you rotate: it decides whether a redeploy is required, and it is covered in Rotating and Redeploying below.

---

## Identifying and Confirming a Leak

Before you act, establish that a secret really is exposed and to whom.

1. **Capture what was leaked.** Record the exact secret, the type from the table above, and the domain or workflow it belongs to. Do not paste the secret value into the incident channel; refer to it by name and location.
2. **Establish the exposure route.** Where did it surface: a commit, a pull request, a log line, a screenshot, an API response, a third-party system? The route determines who could have seen it.
3. **Establish the audience.** A value in a public repository or an external system is far more urgent than one in a private repository visible only to the team. Assume the widest plausible audience until you can prove it was narrower.
4. **Fix the exposure window.** When was the secret first exposed, and is the exposure still live now? Use the commit timestamp, the message time or the log timestamp. This window bounds the misuse investigation later.
5. **Confirm it is a real credential.** Check the value is an active secret and not a placeholder, a test fixture or an already-revoked value. A value flagged by `detect-secrets` in `.secrets.baseline` may be an allow-listed false positive; confirm before you treat it as live.

> If you cannot yet tell whether the secret is live, treat it as live and continue. Confirmation can run in parallel with containment; it must not block it.

---

## Assessing Scope and Impact

Work out what the secret grants, so containment removes the actual risk rather than a guessed one.

1. **Identify what it unlocks.** What does the credential authenticate to, and with what permissions? A read-only third-party key is a different problem from an AWS credential or a signing key.
2. **Map the affected services.** Which domains or workflows consume this secret? Search the domain `resources` configuration and the workflow files for the secret name. A secret shared across domains widens the blast radius and the redeploy list.
3. **Assess data exposure.** Could the secret have been used to read or change data, and whose? Note any personal or otherwise sensitive data within reach, since that raises the escalation and reporting obligations.
4. **Check for blast radius across stages.** Is the same secret, or a value derived from it, used in development, staging and production? Rotate every stage that shares it, not only the one where the leak was spotted.
5. **Decide severity with the incident lead.** A production credential with write access to sensitive data is a high-severity incident; a revoked development key is not. Agree the severity before proceeding, as it drives the escalation and communication path.

---

## Immediate Actions: Contain and Revoke

This is the step that stops the bleeding. Do it before investigation, before the tidy-up of git history, and before writing the timeline.

The golden rule is **revoke at the source first, rotate second**. Removing the leaked value from where it was exposed does not make it safe; anyone who already copied it still holds a working credential. The only thing that neutralises a leaked secret is invalidating it at the system that honours it.

1. **Revoke or disable the credential at its issuer.** For a third-party key, revoke it in that provider's console or API. For an AWS access key, deactivate then delete it in IAM. For a GitHub token, revoke it in the relevant settings. The secret must stop working everywhere, immediately.
2. **If instant revocation would break production, reduce blast radius first.** Where revoking outright would take a live service down, restrict the credential's permissions or scope as an interim step, then rotate in a new value and revoke the old one once traffic has moved. Agree this trade-off with the incident lead; a short controlled degradation can beat an abrupt outage.
3. **Do not rely on deleting the exposure alone.** Force-pushing over a commit, deleting a Slack message or editing a ticket does not revoke anything. Git history in particular is hard to scrub and may already be cloned or cached, which is exactly why the exposed value must be revoked rather than merely hidden. Scrubbing history is follow-up work, not containment.
4. **Record what you revoked and when** in the incident channel, by name and location, never by value.

Only once the leaked value can no longer be used should you move on to rotating in its replacement.

---

## Rotating and Redeploying Affected Services

A new secret is only live once the running services actually use it. How you make that happen depends on the type, and this is where the runtime versus deploy-time split matters.

| Type          | Update the value                                                                    | What makes it take effect                                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `secret`      | `aws secretsmanager put-secret-value --secret-id <name> --secret-string <new>`      | New Lambda execution environments fetch it. Warm containers keep the cached value, so **redeploy the affected domain** to force cold starts (see the caching note below) |
| `ssm:runtime` | `aws ssm put-parameter --name <name> --value <new> --type SecureString --overwrite` | Same as above: new value on next fetch, but **redeploy to be certain** it is live everywhere                                                                             |
| `ssm`         | `aws ssm put-parameter --name <name> --value <new> --type SecureString --overwrite` | The value is baked into an environment variable at deploy time, so a **redeploy of the affected domain is mandatory**; the parameter change alone does nothing           |
| `kms`         | Rotate or replace the key in KMS and re-encrypt anything it protected               | The key reference is injected at deploy time, so **redeploy the affected domain**                                                                                        |
| CI/CD secret  | Update it under the repository or organisation Settings, Secrets and variables      | Nothing changes until the next workflow run, so **re-run any workflow** that consumed it                                                                                 |

> **Caching note.** The Middy `secrets-manager` middleware ([`middleware.ts`](/libs/sdk/src/route/middleware.ts)) caches a fetched secret for the lifetime of a warm Lambda execution environment. A rotated `secret` value is therefore not reliably picked up by containers that are already warm and may still be holding the old, leaked value. Redeploying the affected domain replaces the function version and forces cold starts, which guarantees every invocation reads the new value. When a leaked secret has been rotated, redeploy; do not assume the rotation alone has taken hold.

Redeploys reach production only through the Continuous Deployment pipeline ([`main.yml`](/.github/workflows/main.yml)). No one can deploy directly to production, so a rotation reaches it the same way any change does: raise the change, get it reviewed, and let the pipeline carry it through development, staging and production, approving the staging and production gates as they are reached. Under incident conditions the pipeline is compressed, not bypassed: the review and approval gates still apply. For operating the pipeline and expediting a promotion, see the [Pipeline Promotion runbook](/docs/runbooks/pipeline-promotion.md) and the [Fix Forward runbook](/docs/runbooks/fix-forward.md).

Rotate the value first, then let the pipeline redeploy every stage that shared the secret, not only the one where it leaked.

---

## Investigating Potential Misuse

Containment stops future misuse. This step establishes whether misuse already happened during the exposure window.

1. **Review access at the issuer.** The provider or AWS side is where genuine misuse shows up. For an AWS credential, use CloudTrail to list the API calls made with it, from what source and when. For a third-party key, use that provider's access or audit logs.
2. **Bound the search to the exposure window.** Start from the first exposure time you established earlier and look for activity that does not match expected FLEX behaviour: unfamiliar source addresses, unusual call volumes, actions the service does not normally perform, or access outside expected hours.
3. **Do not expect the secret value in FLEX logs.** The log sanitiser redacts secret keys and values before anything reaches CloudWatch, so the leaked value itself should not appear in FLEX logs. Use CloudWatch to correlate service behaviour around the window, not to find the secret. If the value ever did appear in a log, that is a second leak and a sanitiser gap to raise.
4. **Escalate anything suspicious immediately.** If the logs show the secret was used by someone who should not have used it, this is no longer a precautionary rotation; it is a confirmed breach. Raise the severity with the incident lead and follow the escalation path below.
5. **Record the finding either way.** State plainly whether misuse was found or not, and over what window you looked. "No evidence of misuse between T0 and T1" is a valuable and necessary conclusion.

---

## Escalation and Communication

Clear, prompt communication is part of the response, not an afterthought. A leaked secret often has obligations beyond engineering.

**During the incident:**

1. Raise it in the incident channel `#govuk-app-incident` as soon as it is confirmed, and flag it in `#govuk-once-flex-dev` so the engineering team sees it. State the secret by name and location, the type, the affected services and the severity you agreed. Never post the value.
2. Bring in the incident lead early. A credential with access to sensitive or personal data may carry reporting duties within defined timeframes, and that clock starts at discovery, so do not sit on it.
3. Keep a running timeline: when it was discovered, when it was revoked, when it was rotated, when each stage was redeployed, and what the misuse investigation found.
4. Announce each redeploy as it happens in `#govuk-app-incident` and `#govuk-once-flex-dev`. Do not rely on the automated "Flex deployed" notification: it goes to `#govuk-once-flex-release`, which few people watch.

**After the incident:**

- Post a short summary in `#govuk-app-incident` and `#govuk-once-flex-dev`: what leaked, how it was exposed, what was revoked and rotated, whether any misuse was found, and what remains outstanding.
- Make sure the right people beyond engineering are informed where the severity or the data involved requires it. Confirm with the incident lead who needs to know and by when.

---

## Follow-Up and Prevention

Revoking and rotating stabilises the situation. Closing the incident means removing the residue and making the same leak harder next time.

1. **Scrub the exposure where it still exists.** Now that the secret is dead, clean up the git history, message or artefact that carried it, so it is not copied again or mistaken for live later. This is housekeeping, not containment, and it comes after revocation precisely because history is hard to scrub reliably.
2. **Reconcile the rotated value.** You rotate a secret's value out of band (for example with `put-secret-value`), but the redeploy still goes through the pipeline. If that secret is managed declaratively or seeded by a script, make sure the new value is reflected there too, so a later deploy or seeding run does not revert it to the old, leaked value. Do this before considering the incident closed.
3. **Close the loop on the failed control.** Identify which layer should have caught the leak and strengthen it: add the pattern to `detect-secrets`, extend the log sanitiser, or tighten a review step. A leak that bypassed a control is a gap in that control.
4. **Raise the follow-up work.** Create tickets for any longer-term remediation, for example reducing the credential's scope or shortening its lifetime.
5. **Run the post-incident review.** Capture the timeline, what went well and what slowed you down, and feed anything you had to work out under pressure back into this runbook so the next engineer moves faster.

The goal is that the next leaked secret is caught before it escapes, and that if one does escape, this runbook makes the safe response the obvious one.

---

## Related

**Incident management:**

- [GDS Way: how to manage technical incidents](https://gds-way.digital.cabinet-office.gov.uk/standards/incident-management.html#how-to-manage-technical-incidents)
- [GOF: Incident Process](https://gdsgovukagents.atlassian.net/wiki/spaces/GOF/pages/79495229/Incident+Process) (Confluence)

**Guides:**

- [Log Redaction and Filtering](/docs/log-redaction.md)
- [Deployment Guide](/docs/deployment.md)
- [Releases and Versioning](/docs/releases.md)
- [Environment Setup](/docs/environment-setup.md#aws-credentials)

**Runbooks:**

- [Fix Forward Runbook](/docs/runbooks/fix-forward.md)
- [Pipeline Promotion Runbook](/docs/runbooks/pipeline-promotion.md)

**Configuration and code:**

- [`.pre-commit-config.yaml`](/.pre-commit-config.yaml) (secret scanning hooks)
- [`libs/logging/src/sanitizer.ts`](/libs/logging/src/sanitizer.ts) (log sanitiser)
- [`libs/sdk/src/route/middleware.ts`](/libs/sdk/src/route/middleware.ts) (runtime secret fetching)
