locals {
  env = "development"

  # flex shares a single GCP project across environments — pool and SA IDs are suffixed to avoid conflicts.
  gcp_project_id     = "govuk-app"
  pool_id            = "govuk-flex-smoke-test-dev"
  service_account_id = "govuk-flex-smoke-test-dev"
  provider_id        = "aws-lambda"

  env_tags = {
    Owner       = "govuk-app@digital.cabinet-office.gov.uk"
    Environment = local.env
    Product     = "GOV.UK"
    System      = "flex"
  }
}
