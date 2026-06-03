# Preventing Domain E2E Tests From Blocking the Pipeline

## Problem

Domain end to end (E2E) tests run in the same pipeline that the FLEX team relies on to merge and deploy platform changes. When a domain test fails, it fails the whole job. This blocks PR merges and halts deployments, even when the failure is in a module that the FLEX team does not develop and the platform itself is healthy.

The aim of this document is to agree how we stop domain developer tests from blocking the pipeline in the middle term, and to set out the tickets needed to implement it. The FLEX team will create those tickets.

---

## How the pipeline runs E2E tests today

E2E tests are executed as the final step of the reusable build and deploy workflow, in the same job as the CDK deployment.

```yaml
# .github/workflows/_buildDeploy.yml
- name: Deploy FLEX AWS infra
  run: cd ./platform/infra/flex && pnpm run deploy --require-approval never

- name: E2E tests
  if: inputs.STAGE != 'production'
  env:
    STAGE: ${{ env.STAGE }}
  run: pnpm --filter @flex/e2e test:e2e
```

That single step runs the entire E2E suite in one Vitest invocation, so every test, platform and domain alike, passes or fails as one unit. The reusable workflow is called from two places:

| Caller     | Job                                                                            | Effect of an E2E failure                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`   | `ephemeralEnv` deploys to `pr-<number>` and runs E2E                           | The job fails, which blocks the PR from merging                                                                                               |
| `main.yml` | `deployDev` then `deployStaging` then `deployProd` (each `needs` the previous) | A failure on development or staging halts the chain, so later stages never deploy. Production is skipped by the `STAGE != 'production'` guard |

> The tests are already organised by domain on disk, but they all live in one project, the `@flex/e2e` package. Per domain files live in `tests/e2e/src/domains/` (`dvla`, `example`, `udp`, `uns`) and platform tests live in `tests/e2e/src/platform/` (`auth`, `private-gateway`). They are split by file but not by project and not by execution: a single command runs them all. The team's intended structural direction is for each module's E2E tests to live under that module's own project rather than in a shared E2E package.

Each test block is gated by `isDomainDeployed` and `isRouteDeployed` (see `tests/e2e/src/utils/is-deployed.ts`). These helpers decide whether a test runs for the current stage. They do not change whether a failure counts against the pipeline.

---

## Long term direction

The team expects to move domain code out of this repository, either into per domain repositories or a single domain repository. A stepping stone towards that is to co-locate each module's E2E tests under the module's own project, so the tests travel with the code when it leaves. Once domains live in their own repositories each owns its own pipeline and the coupling described above disappears on its own. This document therefore covers only the middle term: the period between now and that extraction.

---

## Options considered

### Option A: Delete the domain E2E tests

Remove domain test files from the FLEX repository. The argument in favour is that FLEX as a platform should not hold an opinion on the E2E behaviour of modules it does not develop.

The argument against is that these tests already earn their place. They detect real issues in modules where the FLEX team is either directly responsible for fixes or works closely with the owning team (for example DVLA). Deleting them loses that signal during the very period when modules still live in this repository and the team still picks up their failures.

### Option B: Run module tests as a separate, non blocking step that still reports failures (recommended)

Modules are owned by individual teams. Regardless of who maintains a module, its tests must not block the FLEX platform from deploying. The boundary is therefore simple: platform tests versus module tests, decided by what the test belongs to, not by who maintains it.

Split the E2E run into two groups and run them as separate units of work:

1. Platform E2E tests stay blocking. A platform test failure should continue to block merge and deployment, because it signals a defect in the platform itself.
2. Module E2E tests (everything under `domains/`, including `udp`, `uns`, `dvla`, `example` and `local-council`) run in their own step or job that does not gate merge or deployment, but whose failures are still surfaced clearly.

This keeps the detection value that Option A throws away, removes the blocking behaviour that the ticket is about, and mirrors the long term split so the eventual extraction is a smaller change.

The key risk with any non blocking approach is that failures become invisible and rot. The instinct is to mark the step with `continue-on-error`, but that is the wrong tool and we should not use it here: it reports the job as effectively passed, which hides the failure instead of surfacing it.

"Non blocking" and "clearly reported" can be controlled individually rather than through a single setting. We can prevent a failure from blocking a merge by not marking it as a required check. The failure can then be surfaced naturally in the PR actions for developers to see and action if appropriate.

---

## Recommendation

Adopt Option B. Keep the module tests, separate them from the platform tests, and run the module group in a non blocking but clearly reported way.

The reasoning is that the tests remain useful while modules live in this repository, the FLEX team still owns or co owns many of the fixes, and a clean platform versus module split is a natural stepping stone towards co-locating tests under their modules and ultimately moving modules into their own repositories. Option A would discard working signal for a problem that is better solved by isolation than by deletion.

---

## Proposed shape of the solution

This is a sketch to inform the tickets, not a final design.

1. Apply the boundary. The split is platform versus module, decided by what the test belongs to. Every test under `domains/` is non blocking; platform tests stay blocking. There is no per maintainer judgement to make.
2. Co-locate the tests first. Move each module's E2E tests out of the shared `@flex/e2e` package and into the module's own project. This is done first because it makes the platform versus module split fall out of the project structure, gives the dynamic matrix a clean source to discover modules from, and aligns with the eventual extraction. Vitest projects or per package scripts (for example `test:e2e:platform` and `test:e2e:modules`) then invoke the two groups independently.
3. Change the pipeline. In `_buildDeploy.yml`, run the platform group as a blocking step. Run each module in its own job so every domain reports as a separate check, for example `Module E2E (dvla)` and `Module E2E (uns)`. The per domain jobs should come from a dynamic matrix rather than a hardcoded list: a discovery step derives the domain list from the module projects and emits it as JSON, which the matrix consumes via `fromJSON`. Adding a new domain then produces its own check with no workflow edit. Use `fail-fast: false` so one domain failing does not cancel the others. Make the module jobs non blocking by keeping them out of branch protection's required checks rather than by using `continue-on-error`; because required checks are matched by name, a new domain's check is non blocking by default. The module jobs hang off the deploy as leaves; `deployStaging` must keep `needs: deployDev` and never depend on a module job, or a module failure would still halt the chain. Let the module jobs fail and go red.
4. Reporting. No reporting outside the PR is needed. The red, non required check on the PR is the signal: a developer sees it and actions it if appropriate. We deliberately do not add step summaries, JUnit reporters, team channel notifications or opened issues. The deploy step itself and the platform tests stay blocking; only the module test assertions become non blocking.

---

## Open questions

1. PR versus deployment behaviour. On PRs the ephemeral environment deploy can fail for genuine infrastructure reasons. Only the module E2E assertions should be non blocking, not the deploy that precedes them.

Cross domain dependencies (for example `tests/e2e/src/domains/example.test.ts` depending on UDP routes) are a known issue that the team is investigating separately, so they are out of scope here. Two further points are settled by decision: every module test is non blocking regardless of who maintains the module, and module failures are surfaced only as the red, non required check on the PR, with no reporting outside the PR.

---

## Suggested tickets

The FLEX team will create these. They are listed in a sensible delivery order.

| #   | Ticket                                                 | Outcome                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 | Co-locate module E2E tests under their module projects | Each module's E2E tests move out of the shared `@flex/e2e` package into the module's own project, so they travel with the code when modules are extracted and the platform versus module split falls out of the project structure |
| 2 | Run platform and module suites separately, with a dynamic matrix | Platform E2E stays blocking; each domain runs as its own non blocking check from a dynamic matrix discovered from the module projects (not hardcoded), with branch protection required checks updated so the module jobs are not required |
