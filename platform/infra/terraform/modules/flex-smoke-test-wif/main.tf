data "aws_caller_identity" "current" {}
data "google_project" "project" {}

# ── Workload Identity Pool ────────────────────────────────────────────────────

resource "google_iam_workload_identity_pool" "smoke_test" {
  workload_identity_pool_id = var.pool_id
  display_name              = "GOV.UK Flex smoke test"
  description               = "Allows the flex smoke test Lambda to exchange AWS credentials for GCP service account tokens"
}

resource "google_iam_workload_identity_pool_provider" "aws" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.smoke_test.workload_identity_pool_id
  workload_identity_pool_provider_id = var.provider_id
  display_name                       = "AWS Lambda"

  aws {
    account_id = data.aws_caller_identity.current.account_id
  }

  attribute_mapping = {
    "google.subject"     = "assertion.arn"
    "attribute.aws_role" = "assertion.arn.extract('assumed-role/{role}/')"
  }

  # Restricts access to the flex smoke test Lambda execution role only.
  attribute_condition = "attribute.aws_role == \"${var.env}-flex-smoke-test-role\""
}

# ── Service account (App Check only) ─────────────────────────────────────────

resource "google_service_account" "smoke_test" {
  account_id   = var.service_account_id
  display_name = "GOV.UK Flex smoke test (${var.env})"
  description  = "Used by the flex smoke test Lambda to mint Firebase App Check tokens. Scoped to App Check only."
}

resource "google_service_account_iam_member" "smoke_test_sign_blobs" {
  service_account_id = google_service_account.smoke_test.id
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.smoke_test.email}"
}

resource "google_service_account_iam_member" "lambda_wif_binding" {
  service_account_id = google_service_account.smoke_test.id
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.smoke_test.name}/attribute.aws_role/${var.env}-flex-smoke-test-role"
}

# ── Credential config → SSM Parameter Store ──────────────────────────────────

locals {
  credential_config = jsonencode({
    type = "external_account"
    audience = join("", [
      "//iam.googleapis.com/projects/",
      data.google_project.project.number,
      "/locations/global/workloadIdentityPools/",
      var.pool_id,
      "/providers/",
      var.provider_id,
    ])
    subject_token_type                = "urn:ietf:params:aws:token-type:aws4_request"
    token_url                         = "https://sts.googleapis.com/v1/token"
    service_account_impersonation_url = "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${google_service_account.smoke_test.email}:generateAccessToken"
    service_account_email             = google_service_account.smoke_test.email
    credential_source = {
      environment_id                 = "aws1"
      region_url                     = "http://169.254.169.254/latest/meta-data/placement/availability-zone"
      url                            = "http://169.254.169.254/latest/meta-data/iam/security-credentials/"
      regional_cred_verification_url = "https://sts.{region}.amazonaws.com?Action=GetCallerIdentity&Version=2011-06-15"
    }
  })
}

resource "aws_ssm_parameter" "gcp_credential_config" {
  name        = "/${var.env}/flex/smoke-test/gcp-credential-config"
  type        = "String"
  value       = local.credential_config
  description = "GCP Workload Identity Federation credential config for the flex smoke test Lambda. Not a secret."

  tags = var.env_tags
}

resource "aws_ssm_parameter" "gcp_service_account_email" {
  name        = "/${var.env}/flex/smoke-test/gcp-service-account-email"
  type        = "String"
  value       = google_service_account.smoke_test.email
  description = "GCP service account email for the flex smoke test Lambda."

  tags = var.env_tags
}
