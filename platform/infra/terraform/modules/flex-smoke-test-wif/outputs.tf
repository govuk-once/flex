output "service_account_email" {
  description = "GCP service account email used by the smoke test Lambda"
  value       = google_service_account.smoke_test.email
}

output "workload_identity_pool_name" {
  description = "Full resource name of the Workload Identity Pool"
  value       = google_iam_workload_identity_pool.smoke_test.name
}

output "gcp_credential_config_param_name" {
  description = "SSM parameter name containing the GCP credential config"
  value       = aws_ssm_parameter.gcp_credential_config.name
}
