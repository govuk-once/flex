variable "env" {
  description = "Environment name (development, staging, production)"
  type        = string
}

variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
}

variable "pool_id" {
  description = "Workload Identity Pool ID — must be unique within the GCP project"
  type        = string
}

variable "service_account_id" {
  description = "GCP service account ID — must be unique within the GCP project"
  type        = string
}

variable "provider_id" {
  description = "Workload Identity Pool Provider ID"
  type        = string
}

variable "env_tags" {
  description = "AWS resource tags"
  type        = map(string)
}
