variable "source_file" {
  type        = string
  description = "The path to the source JS file"
}

variable "lambda_repository_id" {
  type        = string
  description = "The lambda repository bucket id"
}

variable "lambda_role_arn" {
  type        = string
  description = "The lambda role ARN"
}

variable "method" {
  type        = string
  description = "HTTP method for the lambda to handle"

  validation {
    condition     = contains(["GET", "PUT", "POST", "DELETE", "HEAD"], var.method)
    error_message = "Method must be valid"
  }
}

variable "route" {
  type        = string
  description = "The route that should be handled"
}

variable "api_gw_id" {
  type        = string
  description = "The API Gateway id to attach the handler to"
}

variable "api_gw_execution_arn" {
  type        = string
  description = "The API Gateway ARN allowed to run the generated lambda"
}
