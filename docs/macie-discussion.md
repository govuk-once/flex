# Macie and S3 sensitive data: for discussion

The ITHC action asks us to confirm S3 data is discovered, classified and secured, and to decide whether Macie is warranted for FLEX. I've checked the current AWS docs and lined the issues up so we can each weigh in. Nothing's decided. Where I've leaned one way I've said so, but please push back.

## Where we stand

- No user records in S3. FLEX proxies at request time: DVLA data comes from the DVLA gateway, identity/linking state lives in UDP and is fetched per request. FLEX persists none of it, and nothing is written to S3.
- The only at-rest PII risk in S3 is the CloudFront access-log bucket, and only if a value shows up in a URL. CloudFront writes those logs from the raw request, so the app sanitiser never touches them.
- Buckets are all encrypted: access logs and specs on S3-managed keys, flow logs on a customer-managed KMS key. Macie reads SSE-S3 with no grant; only the flow-log key would ever need one.
- The relevant buckets are in us-east-1. Macie is regional.
- UK PII (licence, NINO, passport, name, address, and so on) all have managed identifiers, so no custom patterns. Not all are on by default though, see below.
- AWS advises against continuous discovery over log buckets on cost and noise grounds, which is awkward given a log bucket is our one surface of interest.

| Bucket                 | Region    | Holds              | PII at rest?               |
| ---------------------- | --------- | ------------------ | -------------------------- |
| CloudFront access logs | us-east-1 | request URLs       | only if PII lands in a URL |
| OpenAPI specs (public) | us-east-1 | published API docs | no                         |
| VPC flow logs          | eu-west-2 | network metadata   | no                         |

## Where UDP's setup doesn't fit as-is

- The KMS marker has nothing to point at: our scannable buckets (access logs, specs) are SSE-S3, no grant needed, and the only customer-managed-key bucket is flow logs, which we wouldn't scan.
- Blanket discovery would sample our logs, public specs and ephemeral per-PR buckets, billed per GB, for little signal, and against AWS's exclude-logs advice.
- The singleton, long-lived-stage constraint is fiddlier for us given per-PR and multi-stage.

## What Macie catches by default

- Automated discovery uses only the default identifier set. Custom identifiers and allow lists are off unless switched on.
- The default set covers the URL-plausible cases: driving licence, NINO, passport, electoral roll number, card numbers, credential headers.
- It does not include name, address, UK phone, NHS number, bank account, DOB, or UTR. Those sit in request bodies, not URLs, so they don't reach the access-log bucket, but worth knowing if we ever scanned a record store.

## Decisions

Add your view under each.

### 1. Enable Macie at all?

- **A. Prevention only.** Keep PII out of URLs, justify Macie as not applicable for our S3 estate.
- **B. Prevention plus a periodic scoped job** on the access-log bucket, for dated assurance.
- **C. Continuous discovery.** Simplest, but against AWS's log guidance.

For what it's worth I lean towards A or B, but I'd rather hear where others land.

_Views:_

### 2. Prevention controls?

Independent of the Macie call: a contract check to keep identifiers out of path/query, drop the query-string field from CloudFront logs, shorten access-log retention (currently 365 days).

_Views:_

### 3. If we run it, what shape?

us-east-1, a KMS-encrypted results bucket, and a periodic scoped job on the access-log bucket rather than always-on discovery. Aligns with option B.

_Views:_

### 4. CI coverage gate?

A check that flags a new domain not yet assessed for coverage, warning and posting to Slack rather than failing the build. Open points if we want it: warn-only or blocking, and whether the note goes to release-notifications or its own channel.

_Views:_

### 5. Log sanitiser (separate)

Found gaps in `libs/logging` (a sensitive key with a nested value isn't redacted). CloudWatch, not S3, so outside Macie's scope. I'll raise a ticket and fix it. Flagging for visibility.

_Views:_

## Spike: domains in a separate repo

If domains split into their own repo that others can push to, while FLEX Platform keeps the infra and governance:

- **Unchanged:** if we run Macie, it is repo-agnostic. It sees the shared access-log bucket whoever produced the traffic.
- **Changes:** the question 4 check assumes one repo so FLEX Platform CI can read `domains/*`. Once domains move out we can't, and in the longer term we may not control who pushes to that repo.

Where to put governance so FLEX Platform keeps control without owning the domains repo:

- **A. Gate at deploy.** Promotion into FLEX Platform's accounts requires "domain assessed". Control at our boundary.
- **B. Observe what's deployed.** Read the live domain set from SSM/tags/gateway and diff against coverage on a schedule. Repo-independent.
- **C. Publish the policy** for the domains repo to run. Lighter, but enforcement sits in a repo we don't fully control.
- **D. Declaration handshake.** Each domain declares its PII (and whether any hits a URL) in its contract; FLEX Platform verifies at deploy.

A and B feel like the ones that keep real control, since they sit on what FLEX Platform owns. It might also be worth giving the clean-URL check in particular a home we can enforce, given another team could regress it. Does that read as fair?
