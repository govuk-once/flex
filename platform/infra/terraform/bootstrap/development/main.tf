data "aws_region" "current" {}

module "state_backend" {
  source = "../../modules/terraform-state-backend"
  name   = "flex-development"

  tags = {
    Owner       = "govuk-app@digital.cabinet-office.gov.uk"
    Environment = "development"
    Product     = "GOV.UK"
    System      = "flex"
  }
}
