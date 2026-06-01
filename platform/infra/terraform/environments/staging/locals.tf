locals {
  env = "staging"

  gcp_project_id     = "govuk-app"
  pool_id            = "govuk-flex-smoke-test-staging"
  service_account_id = "govuk-flex-smoke-test-staging"
  provider_id        = "aws-lambda"

  env_tags = {
    Owner       = "govuk-app@digital.cabinet-office.gov.uk"
    Environment = local.env
    Product     = "GOV.UK"
    System      = "flex"
  }
}
