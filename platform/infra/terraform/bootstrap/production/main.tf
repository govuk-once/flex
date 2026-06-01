data "aws_region" "current" {}

module "state_backend" {
  source = "../../modules/terraform-state-backend"
  name   = "flex-production"

  tags = {
    Owner       = "govuk-app@digital.cabinet-office.gov.uk"
    Environment = "production"
    Product     = "GOV.UK"
    System      = "flex"
  }
}
