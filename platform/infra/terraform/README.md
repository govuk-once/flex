# Flex Terraform — GCP Workload Identity Federation

Provisions the GCP Workload Identity Federation pool, service account, and AWS SSM parameters that allow the flex smoke test Lambda to generate Firebase App Check attestation tokens without storing static GCP credentials.

## Directory structure

```
platform/infra/terraform/
├── bootstrap/                  # One-time setup: creates S3 + DynamoDB for Terraform state
│   ├── development/
│   ├── staging/
│   └── production/
├── environments/               # Per-environment root configs
│   ├── development/
│   ├── staging/
│   └── production/
└── modules/
    ├── flex-smoke-test-wif/    # WIF pool, service account, SSM params
    └── terraform-state-backend/ # S3 bucket + DynamoDB table for Terraform state
```

## State backend naming

Each environment's state is stored in:

```
S3 bucket:      flex-{env}-{account_id}-tfstate
DynamoDB table: flex-{env}-{account_id}-tfstate
KMS key alias:  alias/flex-terraform-key
State key:      smoke-test/workload-identity.tfstate
```

The AWS account ID is appended automatically — it is never stored in source control. In CI the workflow resolves it at runtime via `aws sts get-caller-identity` and injects it into `backend.tfvars` before `terraform init`. When running locally, the bootstrap module reads it directly from your configured AWS credentials.

## Prerequisites

- AWS credentials configured for the target environment
- GCP credentials with permission to manage Workload Identity pools and service accounts in the target GCP project
- Terraform `1.15.5` (pin enforced by `.terraform-version` and `required_version`)

## First-time setup: bootstrap the state backend

The state backend (S3 bucket + DynamoDB table) must be created before Terraform can store state. The bootstrap runs with local state and only needs to be done once per environment.

```bash
cd bootstrap/development

# State is local on first run — the backend "s3" {} block is commented out in state.tf
terraform init
terraform apply

# Note the bucket name from the output, then update backend.tfvars in environments/development/:
# bucket = "flex-development-{account_id}-tfstate"
```

Repeat for `bootstrap/staging` and `bootstrap/production` using credentials for the respective AWS account.

## Running locally

After the state backend exists:

```bash
cd environments/development

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
terraform init \
  -backend-config=backend.tfvars \
  -backend-config="bucket=flex-development-${ACCOUNT_ID}-tfstate"

terraform plan
```

## CI pipeline

The `.github/workflows/terraform.yml` workflow handles plan and apply automatically:

| Event                                                 | Behaviour                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Pull request touching `platform/infra/terraform/**`   | Plans all three environments in parallel, runs Checkov on the plan output |
| Push to `main` touching `platform/infra/terraform/**` | Applies dev → staging → production sequentially                           |
| `workflow_dispatch`                                   | Same as push to main                                                      |

Production apply requires manual approval via the GitHub `production` environment protection rule.

GCP authentication uses org-level secrets provided by the platform team (`DEV_GCP_WORKLOAD_IDENTITY_PROVIDER`, `DEV_GCP_SERVICE_ACCOUNT`, `PROD_GCP_WORKLOAD_IDENTITY_PROVIDER`, `PROD_GCP_SERVICE_ACCOUNT`).

## GCP project mapping

| Stage       | GCP project      |
| ----------- | ---------------- |
| development | dev GCP project  |
| staging     | dev GCP project  |
| production  | prod GCP project |

Update `locals.tf` in each environment with the real GCP project ID before the first apply.
