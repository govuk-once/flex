# Lambda Code Signing — Implementation Plan

Status: **proposed** · Owner: platform team · Scope: `platform/infra/flex` and the release pipeline

## 1. Background

Lambda code in this repository is bundled by CDK's `NodejsFunction` construct
(`aws-cdk-lib/aws-lambda-nodejs`). Each route's handler path is derived in
`platform/infra/flex/src/utils/routes.ts` (`toHandlerPath`), resolved to an
absolute source path in `platform/infra/flex/src/utils/getEntry.ts`, and passed
as `entry` to `NodejsFunction` in:

- `src/constructs/lambda/flex-public-function.ts`
- `src/constructs/lambda/flex-private-egress-function.ts`
- `src/constructs/lambda/flex-private-isolated-function.ts`
- `src/stacks/platform.ts` (jwks endpoint stub — direct `NodejsFunction`)
- `src/utils/create-service-gateway.ts` (service gateway `gateway.ts` entries)
- `src/stacks/credential-monitor.ts`, smoke-test stack, alarm relay constructs

`NodejsFunction` runs esbuild (in Docker) at synth time, zips the result into
`cdk.out/asset.<hash>.zip`, and the CDK CLI uploads it to the toolkit asset
bucket at deploy time. There is **no repo-owned build step** to hook into, and
the resulting keys are opaque to construct code.

## 2. Goal

Sign every team-authored Lambda artifact with AWS Signer and deploy functions
with a `CodeSigningConfig` + versioned signed-code reference so that Lambda
verifies the signature against the signing profile's platform-key certificate
before every invocation. Unsigned or tampered code must fail to run.

### Hard constraint

`AWS::Lambda::Function` with enforced code signing must reference a specific
signed artifact at deploy time:

- `Code`: `S3Bucket`, `S3ObjectKey`, **`S3ObjectVersion`** (versioning-enabled
  bucket), `CodingSigningProfile` fingerprint (+ code size), no inline zip.
- `CodeSigningConfig.SignedCodeConfig`: signing profile name + version,
  `S3ObjectKey`, `S3ObjectVersion`.

The current asset-staging flow cannot supply the key/version of a *signed*
copy, so the artifact source must change. Attaching `codeSigningConfig` to the
existing `NodejsFunction` asset code is not valid.

## 3. Decisions taken

| Decision | Outcome |
| --- | --- |
| Where signing happens | **Pre-sign in CI before synth**; CDK app consumes a manifest |
| Coverage | **All Lambdas in every stack**, one policy |
| Signer profile / platform-key cert | **Pre-provisioned outside the repo** (security team); consumed via SSM |
| Environments | **All environments**, including development |
| CDK custom-resource provider Lambdas | **Exempted** via the custom-resource-provider marker, with a mandatory audit comment (see §5) |

Consequence accepted with "all environments": `cdk deploy --hotswap` and
`cdk watch` stop working for code changes everywhere, because hotswap pushes
unsigned code directly. Documented in §8.

## 4. Target architecture

```
CI (new sign step, runs before cdk synth/deploy/diff)
  1. enumerate every function entry          <- shared module, same code path as synth
     (domain handlers via gateway/route configs, service gateway.ts,
      auth handler + jwks stub, credential-monitor, alarm relays, smoke tests)
  2. esbuild bundle each entry (cjs, node24, output index.js, matching
     current NodejsFunction bundling conventions)
  3. deterministic zip -> sha256 -> key assets/<function-id>/<hash>.zip
  4. upload unsigned zip -> versioned unsigned bucket
     signer:start-signing-job -> poll GetSigningJob -> signed artifact lands
     in versioned signed bucket
  5. write signed-artifacts.manifest.json
     { "<function-id>": { bucket, key, version, codeSize } }

CDK app (platform/infra/flex)
  - Flex*Function constructs become plain `Function` (aws-cdk-lib/aws-lambda)
    with Code.fromBucketWithSigningProperties(bucket, key,
      { s3ObjectVersion, fingerprint })
    + codeSigningConfig.signedCodeConfig { profileName, profileVersion,
      s3ObjectKey, s3ObjectVersion, codeSize }
  - missing manifest entry => synth error (loud; never silently unsigned)
  - new aspect registered in app.ts next to EnforceS3Https / EncryptLogGroups:
    every AWS::Lambda::Function must carry CodeSigningConfig + versioned
    signed Code
```

Signing coordinates (profile name/version, platform-key fingerprint, artifact
bucket) are consumed through the existing SSM export pattern: add to
`platform/infra/flex/src/ssm-keys.ts` under `PLATFORM_KEYS`
(`SigningProfileName`, `SigningProfileVersion`, `SigningPlatformKeyFingerprint`,
`SignedArtifactsBucket`) and read via `this.import(...)`, same as
`HostedZoneId` today.

## 5. The custom-resource landmine (decided)

Stacks using `AwsCustomResource` without an explicit provider (`src/stacks/deploy.ts`,
`src/constructs/infra/CfnPause.ts`, and anything else of that shape) create
CDK **custom-resource provider** Lambda functions whose code ships inside the
`aws-cdk-lib/custom-resources` package. We do not build those bundles, their
S3 keys are CDK-internal, and they cannot be pre-signed by this design.

**Decision (agreed):** exempt them in the enforcement aspect via the
standard custom-resource-provider marker, with written rationale that this
code is AWS-published CDK library code, not team-authored code — which is the
actual threat model. Exemptions must require an auditable comment + reason,
mirroring `applyCheckovSkip` (`src/utils/applyCheckovSkip.ts`). This closes the
only open decision in this plan.

Considered and rejected: a custom `IAssetPublisher` redirecting *all* assets
(including provider assets) through the signing pipeline, for a literal
zero-exceptions policy. High complexity for no additional real assurance over
the exempted, AWS-published code. If policy ever demands it, this is the
escape hatch.

## 6. Workstreams (dependency order)

### W0 — Spike (de-risk first)

Take one development function end-to-end manually:

1. Build + zip one handler entry with esbuild by hand.
2. `aws signer start-signing-job` against it (profile/cert provided by the
   security team in dev).
3. Deploy a minimal template whose `AWS::Lambda::Function` uses
   `Code.fromBucketWithSigningProperties` + `CodeSigningConfig` pointing at the
   signed bucket/key/version.
4. Confirm: invocation succeeds when signed; a re-deployed unsigned artifact is
   rejected at invoke time (and confirm whether validation fails at update or
   at first invoke — record this for the runbook).

Answer early: the certificate fingerprint format expected by CFN (the digest
taken from the ACM cert, as passed to `CodingSigningProfile`), profile-version pinning behaviour, region support, and any
Signer/IAM surprises.

### W1 — Shared entry enumeration + manifest loader

- New module in `platform/infra/flex/src/utils/` (e.g. `function-entries.ts`)
  exporting `enumerateFunctionEntries(configs, stage)` built on the existing
  `getDomainConfigs` / `getServiceGatewayConfigs` / `getDeployableDomains`
  utilities **plus** the hardcoded platform entries (auth `handler.ts`,
  `functions/jwks-endpoint.ts`, credential-monitor, alarm relay, smoke-test,
  and stack-local handlers — inventory completed during W1 from
  `stacks/**` + `constructs/alarms/relay-handler.ts`).
- Function id scheme reuses the existing construct ids (`toPascalCase` of
  gateway/version/route name etc.) so manifest keys are stable.
- Manifest JSON schema + loader (same directory as build output, gitignored);
  loader throws on missing entries.
- Unit tests: enumeration parity with what the stacks create (synth once with
  the aspect disabled and diff the constructed function ids against the
  enumeration).

### W2 — Construct change: NodejsFunction → signed plain Function

- `src/constructs/types.ts`: rebase `FlexFunctionProps` from
  `NodejsFunctionProps` to `FunctionProps` (+ `entry`, `domain`, alarm props).
- `FlexPublicFunction` / `FlexPrivateEgressFunction` /
  `FlexPrivateIsolatedFunction`: construct `Function` from
  `aws-cdk-lib/aws-lambda` with `code` from the manifest entry via
  `Code.fromBucketWithSigningProperties(...)` and `codeSigningConfig`. Keep
  everything else identical (log group with RetentionDays.ONE_YEAR,
  KMS env encryption + grantDecrypt, X-Ray tracing, alarms, tags, VPC/SG props).
- `src/stacks/platform.ts`: jwks stub and authorizer follow the same path.
- Downstream typings update: `src/utils/resources.ts`,
  `src/utils/create-service-gateway.ts` (`NodejsFunction` type → new
  `FlexFunction` type; the `addAlias("live")` / `CfnResource`
  `ProvisionedConcurrencyConfig` override must be re-verified against plain
  `Function`).
- The `entry` prop is retained: it identifies the artifact to the signer and
  lets the loader cross-check manifest vs expectation.

### W3 — Signer script (CI step)

- `platform/infra/flex/src/scripts/sign-artifacts.ts`, next to
  `validate-integrations.ts`; `pnpm sign` script; wired ahead of `synth` /
  `diff` / `deploy` in the release pipeline.
- Consumes W1 enumeration; for each entry: esbuild bundle, deterministic zip
  (sorted entries, fixed timestamps), sha256 content hash → key
  `assets/<function-id>/<hash>.zip`, upload unsigned, start signing job, poll
  to completion, capture signed bucket/key/version/size, write manifest.
- New deps: `@aws-sdk/client-signer` (+ STS/config as needed) and a zip
  library (esbuild itself already exists in the repo — used by the CloudFront
  function construct).
- Failure mode: any job failure fails the pipeline (no partial deploys).
- Incremental behaviour: identical content hash ⇒ skip re-signing (reuse
  existing signed object if present).

### W4 — Enforcement aspect + tests

- `platform/infra/flex/src/aspects/enforce-lambda-code-signing.ts`, registered
  in `src/app.ts` beside `EnforceS3Https` / `EncryptLogGroups`.
- Rule: every `AWS::Lambda::Function` resource must have
  `CodeSigningConfig.SignedCodeConfig` and a `Code` with `S3ObjectVersion` +
  `CodingSigningProfile`; violations throw at synth.
- Exemption mechanism: aspect attributes/skip helper requiring comment +
  reason (pattern: `applyCheckovSkip`); used only for the custom-resource
  provider functions (§5) unless policy changes.
- Tests:
  - aspect unit tests (violation + exemption cases),
  - existing stack template tests updated for the new `Code` shape,
  - global template assertion (e.g. `src/stacks/global.test.ts` /
    `platform.test.ts` style): **zero** Lambda without `CodeSigningConfig`
    outside the exemption list,
  - smoke-test stack extension: positive check that an unsigned artifact is
    rejected (or the documented W0 finding equivalent).

### W5 — Provisioning & handoff checklist (external, security/infra owned)

Per account/region (development, staging, production; region `eu-west-2`):

1. ACM platform-key certificate (ECC/DSA per Signer requirements) + Signer
   signing profile (name + version), values published to SSM:
   `SigningProfileName`, `SigningProfileVersion`,
   `SigningPlatformKeyFingerprint`, `SignedArtifactsBucket`.
2. Versioning-enabled **unsigned** bucket (source for signing jobs) and
   **signed** bucket (signing destination; target of the Lambda Code refs).
3. Pipeline role IAM: `signer:StartSigningJob`, `signer:GetSigningJob`,
   `s3:GetObject` on unsigned bucket, `s3:PutObject`/`GetObject`/
   `ListBucketVersions` on signed bucket. Deployer role unchanged otherwise.
4. No changes needed to the Lambda permissions boundary
   (`src/utils/createPermissionsBoundary.ts`) — execution roles are not
   involved in signing or verification; its `DenyLambdaReconfig` denies apply
   to execution roles only.
5. Bucket policies: Signer service access to unsigned source object and
   signed destination write, restricted to the platform's Signer
   allowlisted account/publisher.

## 7. Rollout sequence

1. Merge W1–W2 behind "synth fails on missing manifest" + keep CI sign step
   green before merging to main (single coordinated merge is acceptable since
   W2 without W3 breaks deploys).
2. Enable the enforcement aspect (`W4`) in the same release.
3. Development first; staging; production — per §3 enforcement applies
   everywhere, so each env's pipeline gains the sign step at once.
4. Runbook update (`docs/runbooks`) covering: signing job failures,
   profile rotation (below), and emergency unsigned deploy (documented,
   audited, requires exemption PR).

## 8. Risks / operational notes

- **Hotswap/watch dead everywhere**: `--hotswap` and `cdk watch` push unsigned
  code directly ⇒ every code change goes through the sign step. Update
  `platform/infra/flex/README.md` dev workflow and call it out in the
  developer docs (`docs/developer-reference.md`).
- **Profile rotation** is a coordinated operation: bump
  `SigningProfileVersion` in SSM → re-sign everything → redeploy, since the
  version is pinned in templates.
- **Deploy latency**: signing jobs take ~1–5 minutes; polling adds pipeline
  time per release; incremental hashing keeps steady-state cost near zero for
  unchanged functions.
- **Manifest/synth coupling**: a new route whose handler was never signed must
  fail loudly at synth (loader) and at pipeline time (enumeration check), not
  silently deploy.
- **Checkov**: new S3/signing resources may trip new CKV rules; use the
  established `applyCheckovSkip(s)` with justifications.

## 9. Definition of done

- `pnpm sign && pnpm deploy` is the only deploy path in every environment.
- Every team-authored Lambda's template has `CodeSigningConfig` + versioned
  signed `Code`; aspect + global template tests prove it; exemptions are
  limited to custom-resource provider functions with audit comments.
- Smoke tests demonstrate unsigned code cannot execute.
- Docs updated: dev workflow (hotswap loss), runbook, provisioning checklist.
