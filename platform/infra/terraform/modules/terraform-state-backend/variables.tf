variable "name" {
  description = "Name prefix for state backend resources (e.g. flex-development). The AWS account ID is appended automatically."
  type        = string
}

variable "tags" {
  description = "AWS resource tags"
  type        = map(string)
}
