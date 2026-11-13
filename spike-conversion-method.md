# Measuring a Conversion: Cost and Difficulty

## Summary

- A **conversion** replaces the mechanism behind a capability while keeping the capability: a tracing SDK, a logging library, a vendor or backend, a runtime, an infrastructure pattern, or the source of truth for a contract.
- Every conversion is judged on two things we can defend with evidence:
  - **Cost**: one-off engineering effort, plus the recurring runtime and operational cost it adds or removes.
  - **Difficulty**: a scored profile of what makes it hard, so the hard part is named rather than averaged away.
- Both come from **a measured slice of the real codebase**, not from estimates alone. The estimate is written down first, so the slice tests it.
- Every claim in a conversion record says what kind of evidence it rests on: `measured`, `traced`, `reported` or `inferred`. Principle 6 defines each one.
- Each conversion produces a record from the template at the end of this document. PLAT-874 (X-Ray to OpenTelemetry) is the first: `spike-xray-to-otel-conversion.md`.

---

## When This Applies

| Use it for | Don't use it for |
|---|---|
| Replacing a library or SDK (X-Ray SDK to OpenTelemetry) | A version bump within the same major with no behaviour change |
| Replacing a vendor or backend (X-Ray to another OTLP backend) | A bug fix |
| A runtime or framework major (Node.js 22 to 24) | Adding a capability that has no current equivalent |
| A new infrastructure pattern (Lambda layer, collector, VPC endpoint) | |
| Moving a source of truth (hand-written Zod to schemas generated from OpenAPI) | |

---

## Principles

1. **Baseline before change.** Measure what the current mechanism does and costs before touching it. A conversion without a baseline can only be described, not compared.
2. **Write the parity contract first.** List what must stay identical, what may change, and what is new. Verification checks against this list.
3. **Slice, then extrapolate.** Convert the smallest unit that exercises the riskiest path, end to end. Extrapolate from it, with the multiplier and its uncertainty stated.
4. **Measure, don't estimate.** Record the estimate before starting and the actuals as you go. The gap between them is itself a finding.
5. **Put it behind a switch that is off by default.** The slice must leave the default build identical, and you prove that with a synth or template diff. It can then sit on a branch or merge safely, and the before and after can be compared in one environment.
6. **Tag every claim with its evidence.**
   - `measured`: something was run; say what, and what it showed.
   - `traced`: the primary source was read directly (code, vendor release notes).
   - `reported`: it rests on another person's or agent's report, not checked.
   - `inferred`: reasoned from what was read or run, but the conclusion itself was not observed (for example, "no IAM change is needed" before anything is deployed).
7. **Check external facts at the primary source.** Vendor release notes and repositories, not search summaries. During PLAT-874, two search answers gave different and wrong layer versions; the release notes gave the right one.
8. **Keep the cost types separate.** One-off and recurring cost are reported apart, and engineering, runtime and operational cost are reported apart too. A cheap one-off change can carry an expensive recurring cost, and the reverse.
9. **Record AI-assisted effort separately.** It shows how much work there is, not how long it takes a team member. Report it as such, and don't present it as a team estimate.
10. **Local experiments must not touch the host.** Before running production code locally, check its side effects. FLEX route and gateway handlers delete everything in `/tmp` after each invocation unless `NODE_ENV=test` (`libs/sdk/src/utils/cleanup.ts`).
11. **Keep the artefacts.** A claim tagged `measured` needs its output saved where a reviewer can read it: logs, captured payloads, synth output, gate results, and a running log of failed attempts. If the output wasn't kept, the claim is `reported`.

---

## Phases

| Phase | What happens | Output |
|---|---|---|
| 0. Frame | Ticket, the question asked, the decision it feeds, exit criteria, timebox, owner | Frame section of the record |
| 1. Inventory | Find every touchpoint of the current mechanism, counted by category (list below) | Inventory table: touchpoint, location, count, in slice (yes or no) |
| 2. Baseline | Measure the current mechanism: behaviour, performance, cost, size | Baseline table with units and sources |
| 3. Parity contract | What must stay identical, what may change, what is new | Parity table |
| 4. Slice | Convert the smallest unit that exercises the riskiest path, behind a switch that is off by default | Branch, commit, switch name, diff stat |
| 5. Verify | Local evidence, synth or template diff, lint, type check and tests green, then deployed before-and-after comparison | Evidence table, gate results |
| 6. Extrapolate | Per-unit cost times the number of units, plus fixed cost, with uncertainty | Cost tables |
| 7. Decide and record | Recommendation, open questions, the decision and who made it | Decision section of the record; a link to the team's own decision record, if it keeps one |

### Inventory categories

Count each one, even when the count is zero. A zero is a finding.

- Code call sites of the current library or API
- Infrastructure constructs and their settings
- IAM: execution roles, permissions boundary, managed policies
- Network: VPC endpoints, egress, isolated subnets
- Build and bundling: bundler settings, output format, handler export shape
- Runtime configuration: environment variables, layers, wrapper scripts
- CI/CD: pipelines, required checks, deploy order
- Tests: unit, synth, E2E, mocks of the current mechanism
- Observability: alarms, dashboards, log fields, trace IDs, correlation IDs
- Docs and runbooks that tell people how to use the current mechanism
- Data classification: what data the new mechanism records, and where it is sent
- Other teams, accounts and approvals (Platform, security, Central Observability)

---

## What to Measure

### Cost

| Type | Measure | How | Unit |
|---|---|---|---|
| One-off engineering | Active effort per phase | Running log kept during the work | Hours |
| | Elapsed time | Branch creation to verified slice | Days |
| | Change size | `git diff --stat` of the slice | Files, lines added and removed |
| | Coverage | Touchpoints converted out of the inventory total | Ratio |
| | Iterations | Failed build, test or deploy cycles before green | Count |
| | Review effort | Reviewer time | Hours |
| | Rollout | Steps and approvals per environment | Count |
| Recurring runtime | Service cost change | Vendor pricing page (cite it with its date) multiplied by measured volumes | £ per environment per month |
| | Cold start | Lambda `Init Duration` from REPORT lines, p50 and p95, before and after | ms |
| | Request latency | API Gateway `Latency` p95, before and after | ms |
| | Package size | Function plus layers, unzipped, against the 250 MB limit | MB, % of limit |
| Recurring operational | New dependencies | Count, owner, release cadence, support status | Count |
| | New permissions and network paths | IAM, boundary and endpoint changes | Count |
| | Maintenance created | Recurring tasks, such as bumping a pinned layer version | Tasks per year |
| | Docs and runbooks to change | From the inventory | Count |
| Exit | Revert cost | Steps and time to switch back; whether data or history is lost | Hours, yes or no |

### Difficulty

Score each dimension from 1 to 3. Report the whole profile: the overall difficulty is the highest score, and every 3 is named in the record's summary as a risk. Never add the scores up, because a single 3 can block a conversion that is easy everywhere else.

| Dimension | 1 | 2 | 3 |
|---|---|---|---|
| Breadth | Under 5 touchpoints | 5 to 20 touchpoints | Over 20, or every domain |
| Depth | Configuration only | Library swap behind an existing seam | Change at every call site, or an architectural change |
| Unknowns | None | Answerable locally | Answerable only when deployed, or only by another team |
| Verifiability | Existing tests or synth cover it | Needs a local harness | Needs a deployed environment or production traffic |
| Reversibility | Switch off and redeploy, nothing left behind | Code revert and redeploy | Data or contract migration |
| Coupling | One team | Another FLEX area | Other teams, accounts or approvals |
| Constraints | None | One (for example the permissions boundary) | Several (isolated network, production access, data classification) |

---

## Record Template

Copy this into `spike-<from>-to-<to>-conversion.md` and fill in every section. Write "none" rather than deleting a section.

```markdown
# Conversion Record: <from> to <to> (<ticket>)

## Summary
- Deploying with the switch off: <what changes, ideally nothing>; with it on: <what it introduces>
- Cost: one-off <...>; recurring <...>
- Difficulty: <overall score>, driven by <dimensions scored 3>
- Recommendation: <...>

## Frame
| Item | Value |
|---|---|
| Ticket | |
| Question | |
| Decision it feeds | |
| Exit criteria | |
| Timebox | |
| Owner | |

## Inventory
| Touchpoint | Location | Count | In slice | Change |
|---|---|---|---|---|

## Baseline
| Measure | Value | Unit | Source | Evidence |
|---|---|---|---|---|

## Parity contract
| Must stay identical | May change | New |
|---|---|---|

## Slice
| Item | Value |
|---|---|
| Branch | |
| Commit | |
| Switch | |
| Diff stat | |
| Default build unchanged | how this was proved |

## Evidence
| Claim | Evidence | Source |
|---|---|---|

## Cost
| Type | Measure | Estimate | Actual | Evidence |
|---|---|---|---|---|

## Difficulty profile
| Dimension | Score | Why |
|---|---|---|

## Extrapolation
<per-unit cost x units + fixed cost, with uncertainty>

## Open questions
| Question | How to answer | Who |
|---|---|---|

## Decision
<recommendation, decision, date, who decided, the evidence it rests on>
```
