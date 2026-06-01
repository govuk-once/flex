locals {
  env = "production"

  # Production gets the clean name without env suffix.
  gcp_project_id     = "govuk-app"
  pool_id            = "govuk-flex-smoke-test"
  service_account_id = "govuk-flex-smoke-test"
  provider_id        = "aws-lambda"

  env_tags = {
    Owner       = "govuk-app@digital.cabinet-office.gov.uk"
    Environment = local.env
    Product     = "GOV.UK"
    System      = "flex"
  }
}
