---
title: Leaked secret
description: Contain, rotate and investigate a secret that may have been exposed.
---

Use this runbook when a secret, such as an API key, password, token, private key or signing key,
may have been exposed. A leaked secret is a live risk from the moment it is exposed, so the order of
the steps matters: contain first, investigate after.

Treat every suspected leak as real until you have proved otherwise. Revoking a secret that turns out
to be safe costs minutes. Leaving an exposed one working can cost far more.

A leak is an incident. Follow [Communicating during an incident](/flex/runbooks/overview/#communicating-during-an-incident)
alongside these steps: raise it in `#govuk-app-incident` and `#govuk-once-flex-dev` as soon as it is
confirmed, agree an incident lead and a severity, and keep a timeline. Refer to the secret by name
and location. Never post its value.

Revoking and rotating needs write access you will not normally have. Ask the Platform Team for
temporary access as soon as you start.

## Where Flex keeps secrets

A secret's value lives in AWS Secrets Manager and nowhere else. A function's environment variable
holds the secret's name or ARN, never its value. Most secrets are created outside this repository,
in the `flex-params` repository.

| Secret | Name | Read by |
|---|---|---|
| Domain `secret` resources | `/<env><path>`, or `/<stage><path>` for a stage-scoped resource | Domain routes, at runtime. See [Resources](/flex/domains/resources/). |
| Service gateway secrets, such as `consumerConfig` | ARN held in SSM at `/<env>/flex-param<path>` | Service gateways, at runtime. See [Service gateway configuration](/flex/gateways/configuration/). |
| CloudFront origin secret | `/<stage>/flex-secret/origin-verify-secret` | CloudFront and the API web ACL |
| WAF E2E bypass | `/<stage>/flex-secret/waf/e2e-bypass` | The CloudFront web ACL and the E2E tests |
| Smoke test user and E2E signing key | `/<env>/flex-secret/smoke-test/*`, `/<env>/flex-secret/auth/e2e/private_jwk` | The smoke test and E2E tests |
| GitHub Actions secrets | `SONAR_TOKEN_FLEX`, `SONAR_URL`, the `*_DEPLOYMENT_ROLE` and `ROLE_TO_ASSUME` role ARNs | Workflows |

`ssm` and `ssm:runtime` resources hold configuration, and `kms` resources hold only a key ARN: key
material never leaves KMS. If a secret value has been stored in an SSM parameter, that is a second
defect to fix. The deployment role ARNs are references, not credentials, because the workflows use
OIDC.

## 1. Confirm and scope the leak

Spend minutes here, not hours. If you cannot yet tell whether the secret is live, treat it as live
and move on to step 2 while you finish this one.

1. Record what leaked: the secret's name, its type from the table above, and what uses it. Search
   for its path in `domains/*/domain.config.ts` and `platform/domains/*/gateway.config.ts`.
2. Record where it surfaced (a commit, a pull request, a log line, a screenshot, a ticket, a
   message) and who could have seen it. This repository is public: anything committed to it is
   exposed to everyone. Assume the widest audience until you can show otherwise.
3. Record the exposure window: when it was first exposed, and whether it still is.
4. Record what it grants, and whether the same value is used in more than one environment. Rotate
   every environment that shares it.
5. Check it is a real credential, not a placeholder, a test fixture or a value already revoked. A
   value already in `.secrets.baseline` may be a known false positive.

## 2. Revoke it at the source

Removing the value from where it leaked does not make it safe. Anyone who copied it still has a
working credential. Only invalidating it where it is accepted does.

1. Revoke or disable the credential with whoever issues it: the third party's console or support
   route, IAM for an AWS access key, GitHub for a token, SonarQube for `SONAR_TOKEN_FLEX`.
2. If revoking at once would take production down, agree with the incident lead whether to reduce
   its permissions first, rotate in a new value, then revoke the old one once traffic has moved. A
   short controlled degradation can be better than an outage.
3. Do not count deleting the message, editing the ticket or force-pushing over the commit as
   containment. Git history is copied and cached. Clean it up later, after revocation.
4. Record in the incident thread what you revoked and when.

## 3. Rotate in a new value

1. Store the new value:

   ```bash
   aws secretsmanager put-secret-value \
     --secret-id "<secret name or ARN>" \
     --secret-string file://new-secret.json \
     --region eu-west-2
   ```

   Read the value from a file, never from the command line, so it does not land in shell history.
   Delete the file afterwards.

   The DVLA gateway's secret has a rotation function that changes the DVLA password and requests a
   new API key every 60 days. Trigger it now instead of setting a value by hand:

   ```bash
   aws secretsmanager rotate-secret \
     --secret-id "$(aws ssm get-parameter --name /<env>/flex-param/dvla/consumer-config-secret-arn --query Parameter.Value --output text --region eu-west-2)" \
     --region eu-west-2
   ```

   It logs to the `<env>-FlexCore` stack's `DvlaSecretRotation` function, and has no retries: if it
   fails part way, read its logs before running it again.

2. If `flex-params` seeds the secret, update it there too, so a later seeding run does not put the
   leaked value back.
3. For a GitHub Actions secret, update it under the repository's **Settings** > **Secrets and
   variables** > **Actions**. Workflows pick it up on their next run.

## 4. Make sure nothing still uses the old value

A new value is only live once the running functions read it. Functions cache secrets:

| Reader | Cache | What to do |
|---|---|---|
| Domain route (`secret` or `ssm:runtime` resource) | For the life of a warm execution environment, which can be hours | Force new execution environments, below. |
| Service gateway | 10 minutes | Wait 10 minutes. |

A redeployment with no change to the function does not replace warm execution environments,
because CloudFormation has nothing to update. Changing the function's configuration does. For each
function that reads the secret, update its description:

```bash
aws lambda update-function-configuration \
  --function-name "<function name>" \
  --description "Secret rotated $(date -u +%FT%TZ)" \
  --region eu-west-2
```

Every invocation after the update runs in a new execution environment and reads the new value. The
description has no effect on behaviour, so it does not matter if a later deployment resets it.

The CloudFront origin secret and the WAF E2E bypass are different. CDK generates them and
CloudFormation resolves their values into the distribution and the web ACLs at deploy time, so a new
value only takes effect when CloudFormation updates those resources. Get help from
`govuk-once-flex-developers` to rotate them.

Do this in every environment that shares the secret. If the fix also needs a code or configuration
change, or a redeployment, ship it as described in [Fix forward](/flex/runbooks/fix-forward/). See
[Environments](/flex/delivery/environments/) for the deployment mechanics.

Announce each rotation and refresh in the incident thread. Do not rely on the automated deployment
notification: few people watch that channel.

## 5. Look for misuse

Containment stops future misuse. This step finds out whether it already happened in the exposure
window.

1. Read the access or audit logs where the secret is accepted. For an AWS credential, search
   CloudTrail for its access key ID: **CloudTrail** > **Event history** > **Access key**. For a third
   party, ask them or use their audit logs.
2. Look for activity in the exposure window that does not match Flex: unfamiliar source addresses,
   unusual volumes, actions Flex never performs, activity at unusual times.
3. Do not expect to find the value in Flex logs. The logger redacts secrets before they reach
   CloudWatch. If the value does appear in a log, that is a second leak and a redaction defect. See
   [Logging](/flex/observability/logging/).
4. If you find misuse, this is a confirmed breach, not a precaution. Raise the severity with the
   incident lead at once. Personal data within reach may bring reporting duties with deadlines that
   start at discovery.
5. Record the result either way, with the window you searched: "no evidence of misuse between T0
   and T1" is a finding.

## 6. Close it out

1. Clean up where the value was exposed: rewrite git history, delete the message or the artefact.
2. Find the control that should have caught the leak and strengthen it:

   | Control | Catches |
   |---|---|
   | `detect-secrets` and `detect-private-key` in [`.pre-commit-config.yaml`](https://github.com/govuk-once/flex/blob/main/.pre-commit-config.yaml), against `.secrets.baseline` | A secret being committed locally |
   | The same hooks in the Quality Checks workflow's Hygiene job | A secret reaching a pull request or `main`. See [Security scanning](/flex/delivery/security-scanning/). |
   | The log sanitiser in `@flex/logging` | A secret being written to CloudWatch. See [Logging](/flex/observability/logging/). |

3. Post a summary in `#govuk-app-incident` and `#govuk-once-flex-dev`: what leaked, how, what was
   revoked and rotated, whether misuse was found, and what is outstanding. Confirm with the
   incident lead who else needs to know.
4. Raise tickets for longer-term work, such as narrowing the credential's scope or shortening its
   lifetime, and run a post-incident review. Then follow
   [After recovery](/flex/runbooks/overview/#after-recovery).
