output "s3_bucket_name" {
  description = "S3 bucket name for Terraform state"
  value       = aws_s3_bucket.terraform_state.bucket
}

output "kms_alias_name" {
  description = "KMS key alias used for state encryption"
  value       = aws_kms_alias.terraform.name
}
