terraform {
  required_version = "= 1.15.5"

  # Comment out when initially creating the S3 bucket / DynamoDB table.
  # See README.md in this directory for full bootstrap instructions.
  # backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 3.59.0"
    }
  }
}

provider "aws" {
  region = "eu-west-2"
}
