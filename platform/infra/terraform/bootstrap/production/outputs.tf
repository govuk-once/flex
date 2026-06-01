output "bucket" {
  description = "Terraform S3 state bucket name"
  value       = module.state_backend.s3_bucket_name
}

output "dynamodb_table" {
  description = "Terraform DynamoDB lock table name"
  value       = module.state_backend.dynamodb_table_name
}

output "kms_key_id" {
  description = "Terraform KMS key alias"
  value       = module.state_backend.kms_alias_name
}

output "encrypt" {
  description = "Enable encryption"
  value       = true
}

output "region" {
  description = "AWS region"
  value       = data.aws_region.current.region
}

output "key" {
  description = "S3 state file key for the bootstrap state itself"
  value       = "bootstrap.tfstate"
}
