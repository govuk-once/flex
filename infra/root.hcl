locals {
  aws_region = "eu-west-2" // only available region
  # Automatically load account-level variables
  account_vars = read_terragrunt_config("account.hcl")


  # Extract the variables we need for easy access
  account_name = local.account_vars.locals.account_name
  account_id   = local.account_vars.locals.aws_account_id
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region = "${local.aws_region}"

  # Only these AWS Account IDs may be operated on by this template
  allowed_account_ids = ["${local.account_id}"]
}
EOF
}

generate "terraform" {
  path      = "terraform.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
terraform {
  required_version = ">= 1.14.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.1.0"
    }
  }
}
EOF
}

// TODO: Commented out for now as we don't have a shared state bucket yet
// Used to generate remote state configuration for the bootstrap environment
//
// remote_state {
//   backend = "s3"
//   config = {
//     encrypt = true
//     bucket = "${get_env("TF_BUCKET_PREFIX", "")}flex-terraform-state-${local.account_name}-${local.aws_region}"
//     key = "${path_relative_to_include()}/terraform.tfstate"
//     region = "${locals.aws_region}"
//     dynamodb_table = "flex-terraform-state-lock"
//   }
//   generate = {
//     path = "backend.tf"
//     if_exists = "overwrite_terragrunt"
//   }
// }

# Configure what repositories to search when you run 'terragrunt catalog'
// catalog { urls = [] }

# ---------------------------------------------------------------------------------------------------------------------
# GLOBAL PARAMETERS
# These variables apply to all configurations in this subfolder. These are automatically merged into the child
# `terragrunt.hcl` config via the include block.
# ---------------------------------------------------------------------------------------------------------------------

# Configure root level variables that all resources can inherit. This is especially helpful with multi-account configs
# where terraform_remote_state data sources are placed directly into the modules.
// inputs = {}
