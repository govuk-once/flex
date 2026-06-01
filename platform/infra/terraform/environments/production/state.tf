terraform {
  required_version = "= 1.15.5"

  backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 3.59.0"
    }
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = "eu-west-2"
}

provider "google" {
  project = local.gcp_project_id
}
