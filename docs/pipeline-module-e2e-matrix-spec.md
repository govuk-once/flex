# Spec: Dynamic per domain E2E matrix

Status: Ready to implement

Related: ticket 2 ("Run platform and module suites separately, with a dynamic matrix")

This spec is self contained so it can be picked up in a fresh context. It covers ticket 2 only. Ticket 1 (co-location) is a precondition, see below.

---

## Goal

Run each domain's E2E suite as its own pipeline check that is discovered automatically from the repository, fails visibly on the PR, but never blocks a merge or halts a deployment. Adding a new domain must produce its own check with no edit to any workflow file.

---

## Context (current state)

E2E tests run today as the final step of the reusable workflow `.github/workflows/_buildDeploy.yml`, in the same job as the CDK deploy:

```yaml
- name: Deploy FLEX AWS infra
  run: cd ./platform/infra/flex && pnpm run deploy --require-approval never

- name: E2E tests
  if: inputs.STAGE != 'production'
  env:
    STAGE: ${{ env.STAGE }}
  run: pnpm --filter @flex/e2e test:e2e
```

`_buildDeploy.yml` is called from two places:

| Caller       | Job                                                        | Stage(s)                          |
| ------------ | ---------------------------------------------------------- | --------------------------------- |
| `ci.yml`     | `ephemeralEnv`                                             | `pr-<number>`                     |
| `main.yml`   | `deployDev` then `deployStaging` then `deployProd`         | `development`, `staging`, (prod E2E skipped) |

In `main.yml` the stages are chained with `needs`, so any E2E failure on development or staging fails the called workflow, fails the caller job, and halts the chain before production. On PRs the same failure fails `ephemeralEnv`. This coupling is the problem the decision doc addresses.

The E2E project is the `@flex/e2e` package at `tests/e2e`. The global setup `tests/e2e/src/setup.global.ts` reads CloudFormation outputs from the stack `{stage}-FlexPlatform` using AWS credentials and the `STAGE` env var, so every job that runs E2E needs AWS credentials and `STAGE`, not just network access.

Domain packages are named `@flex/<name>-domain` and live under `domains/`.

---

## Preconditions (delivered by ticket 1, co-location)

1. Each domain that has E2E tests exposes a `test:e2e` script in its `domains/<name>/package.json`. This script presence is the discovery contract used below. Domains without E2E tests simply omit the script and are not discovered.
2. Platform E2E tests can be invoked on their own, for example `pnpm --filter @flex/e2e test:e2e:platform` (or whatever the platform group becomes after co-location). Platform tests stay blocking and stay in the deploy job, see below.

> If ticket 1 is not yet merged, do not start this work. The discovery contract depends on the per domain `test:e2e` scripts existing.

---

## Target architecture

The key decision is that module E2E becomes a leaf that nothing in the deploy chain depends on, in both callers. That isolation, not `continue-on-error`, is what makes it non blocking. Do not use `continue-on-error`: it reports the job green and hides the failure. We want the check to go red.

Introduce a new reusable workflow `.github/workflows/_moduleE2E.yml` with two jobs: a discovery job that emits the matrix, and a matrix job that runs one domain per leg.

```yaml
# .github/workflows/_moduleE2E.yml
name: Module E2E

on:
  workflow_call:
    inputs:
      AWS_REGION:
        type: string
      STAGE:
        type: string
        required: true
    secrets:
      ROLE_TO_ASSUME:
        required: true

jobs:
  discover:
    runs-on: ubuntu-latest
    outputs:
      modules: ${{ steps.list.outputs.modules }}
    steps:
      - uses: actions/checkout@<pin-to-sha>
      - id: list
        # Emit a JSON array of { name, package } for every domain with a test:e2e script.
        run: |
          modules=$(node -e '
            const fs=require("fs"), path=require("path");
            const out=[];
            for (const d of fs.readdirSync("domains")) {
              const pj=path.join("domains", d, "package.json");
              if (!fs.existsSync(pj)) continue;
              const j=JSON.parse(fs.readFileSync(pj,"utf8"));
              if (j.scripts && j.scripts["test:e2e"]) out.push({ name: d, package: j.name });
            }
            process.stdout.write(JSON.stringify(out));
          ')
          echo "modules=$modules" >> "$GITHUB_OUTPUT"

  test:
    needs: discover
    if: needs.discover.outputs.modules != '[]'
    runs-on: ubuntu-latest
    name: Module E2E (${{ matrix.module.name }})
    permissions:
      id-token: write # OIDC for AWS
    strategy:
      fail-fast: false # one domain failing must not cancel the others
      matrix:
        module: ${{ fromJSON(needs.discover.outputs.modules) }}
    env:
      STAGE: ${{ inputs.STAGE }}
    steps:
      - uses: actions/checkout@<pin-to-sha>
      - uses: actions/setup-node@<pin-to-sha>
        with:
          node-version-file: ".nvmrc"
      - run: |
          npm install -g pnpm@latest-10
          pnpm install
      - uses: aws-actions/configure-aws-credentials@<pin-to-sha>
        with:
          role-to-assume: ${{ secrets.ROLE_TO_ASSUME }}
          aws-region: ${{ inputs.AWS_REGION }}
          role-session-name: ${{ github.run_id }}
      - run: pnpm --filter ${{ matrix.module.package }} test:e2e
```

Then wire it into the callers as a leaf.

`ci.yml`:

```yaml
moduleE2E:
  name: Module E2E
  needs: ephemeralEnv # runs after the ephemeral deploy, but nothing depends on this job
  uses: ./.github/workflows/_moduleE2E.yml
  with:
    AWS_REGION: "eu-west-2"
    STAGE: pr-${{ github.event.pull_request.number }}
  secrets:
    ROLE_TO_ASSUME: ${{ secrets.DEV_DEPLOYMENT_ROLE }}
```

`main.yml` (module E2E on development and staging only, never production, and never in the deploy chain):

```yaml
moduleE2EDev:
  needs: deployDev
  uses: ./.github/workflows/_moduleE2E.yml
  with: { AWS_REGION: "eu-west-2", STAGE: "development" }
  secrets: { ROLE_TO_ASSUME: ${{ secrets.DEV_DEPLOYMENT_ROLE }} }

moduleE2EStaging:
  needs: deployStaging
  uses: ./.github/workflows/_moduleE2E.yml
  with: { AWS_REGION: "eu-west-2", STAGE: "staging" }
  secrets: { ROLE_TO_ASSUME: ${{ secrets.STAGING_DEPLOYMENT_ROLE }} }
```

Critically, `deployStaging` keeps `needs: deployDev` and `deployProd` keeps `needs: deployStaging`. Neither depends on a `moduleE2E*` job, so a module failure leaves the run red but the deploy chain proceeds to production.

Remove the existing combined `E2E tests` step from `_buildDeploy.yml` and replace it with a platform only step that stays blocking:

```yaml
- name: Platform E2E tests
  if: inputs.STAGE != 'production'
  env:
    STAGE: ${{ env.STAGE }}
  run: pnpm --filter @flex/e2e test:e2e:platform
```

---

## Discovery contract

A domain is included in the matrix if and only if `domains/<name>/package.json` declares a `test:e2e` script. The discovery job emits a JSON array of objects:

```json
[{ "name": "dvla", "package": "@flex/dvla-domain" }, { "name": "uns", "package": "@flex/uns-domain" }]
```

`name` drives the check label (`Module E2E (dvla)`); `package` drives the pnpm filter. Keying off the script rather than globbing test files keeps discovery explicit and avoids guessing at file naming. If a later refactor moves to test file globs instead, only the discovery job changes; the rest of the spec holds.

---

## Non blocking mechanism

Whether a check blocks a merge is decided by branch protection, not by the workflow. After the first run creates the `Module E2E (<name>)` checks:

1. Confirm the deploy and platform checks (`ephemeralEnv`, quality checks) remain in the required status checks list.
2. Confirm no `Module E2E (*)` check is in the required list. Required checks are matched by exact name and cannot be wildcarded, so a new domain's check is never required by default. That is the property that makes new domains non blocking automatically.

This is a repository settings change, out of band from the workflow files, and must be done as part of the ticket.

---

## Behaviour matrix

| Scenario                                  | Deploy / platform checks | Module E2E check        | Merge blocked? | Deploy chain halted? |
| ----------------------------------------- | ------------------------ | ----------------------- | -------------- | -------------------- |
| Domain test fails on a PR                 | green                    | red                     | no             | n/a                  |
| Domain test fails on `main` (dev/staging) | green                    | red                     | n/a            | no, prod still ships |
| Platform test or deploy fails             | red                      | skipped / not reached   | yes            | yes                  |
| New domain added with a `test:e2e` script | unchanged                | new red/green check     | no             | no                   |
| Production deploy                          | green                    | not run                 | n/a            | n/a                  |

---

## Edge cases

1. No domains have E2E tests. Discovery emits `[]`; the `test` job is guarded by `if: needs.discover.outputs.modules != '[]'` and is skipped cleanly. `fromJSON('[]')` would also yield no matrix legs, so this is belt and braces.
2. A domain has a `test:e2e` script but no tests for the current stage. Vitest with `--passWithNoTests` (and the existing `isDomainDeployed` / `isRouteDeployed` gating) returns success, so the check is green. No change needed.
3. Discovery runs in parallel with deploy. It only reads source, so it does not need the deploy. The `test` job needs both the deploy (endpoints must exist) and discovery (matrix list).

---

## Acceptance criteria

1. Each domain with a `test:e2e` script appears as its own `Module E2E (<name>)` check on PRs.
2. A failing domain test shows that check red but does not block merge and does not stop the `main` pipeline reaching production.
3. Platform E2E and deploy remain blocking on both PRs and `main`.
4. Adding a new domain with a `test:e2e` script produces a new check with no edit to any workflow file.
5. Production deploys run no module E2E.
6. No use of `continue-on-error` for module E2E.

---

## Out of scope

- Co-location of tests into module projects (ticket 1, a precondition).
- Cross domain test dependencies (for example `example` depending on UDP routes), tracked separately.
- Any reporting beyond the red PR check: no step summaries, JUnit reporters, channel notifications or opened issues.

---

## Open questions for the implementer

1. Should module E2E run on staging in `main.yml`, or only on development and ephemeral PR envs? This spec runs it on both development and staging to match the current non production behaviour; confirm that is wanted.
2. Each matrix leg re-installs dependencies and re-authenticates to AWS. With several domains this multiplies setup cost. Accept it for the per domain check granularity, or revisit with a single combined job if cost becomes a concern.
3. Whether the platform E2E group is invoked via a dedicated script (`test:e2e:platform`) or a Vitest project name. This depends on how ticket 1 implements the split.

---

## File change checklist

- [ ] Add `.github/workflows/_moduleE2E.yml` (discovery + matrix).
- [ ] Edit `.github/workflows/_buildDeploy.yml`: replace the combined `E2E tests` step with a platform only step.
- [ ] Edit `.github/workflows/ci.yml`: add the `moduleE2E` leaf job.
- [ ] Edit `.github/workflows/main.yml`: add `moduleE2EDev` and `moduleE2EStaging` leaf jobs; confirm the deploy chain `needs` are unchanged.
- [ ] Update branch protection: keep deploy and platform checks required; ensure no `Module E2E (*)` check is required.
- [ ] Pin all third party actions to a SHA, matching the existing convention in the repo.
