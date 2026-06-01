data "aws_region" "current" {}

module "state_backend" {
  source = "../../modules/terraform-state-backend"
  name   = "flex-staging"

  tags = {
    Owner       = "govuk-app@digital.cabinet-office.gov.uk"
    Environment = "staging"
    Product     = "GOV.UK"
    System      = "flex"
  }
}
