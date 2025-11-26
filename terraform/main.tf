terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = "eu-west-2"
}

resource "aws_s3_bucket" "lambda_repository" {
  bucket = "${var.prefix}-lambda-repository"
}

resource "aws_iam_role" "lambda_exec" {
  name = "${var.prefix}-lambda-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Sid    = ""
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_apigatewayv2_api" "lambda_gateway" {
  name          = "${var.prefix}-lambda-gateway"
  protocol_type = "HTTP"
}

resource "aws_cloudwatch_log_group" "lambda_gateway" {
  name = "/aws/api_gw/${aws_apigatewayv2_api.lambda_gateway.name}"

  retention_in_days = 30
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.lambda_gateway.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.lambda_gateway.arn

    format = jsonencode({
      requestId               = "$context.requestId"
      sourceIp                = "$context.identity.sourceIp"
      requestTime             = "$context.requestTime"
      protocol                = "$context.protocol"
      httpMethod              = "$context.httpMethod"
      resourcePath            = "$context.resourcePath"
      routeKey                = "$context.routeKey"
      status                  = "$context.status"
      responseLength          = "$context.responseLength"
      integrationErrorMessage = "$context.integrationErrorMessage"
    })
  }
}

locals {
  handlers = [
    { source_file = "${path.module}/../dist/a/get.js", method = "GET", route = "/a" },
    { source_file = "${path.module}/../dist/b/get.js", method = "GET", route = "/b" },
    { source_file = "${path.module}/../dist/c/get.js", method = "GET", route = "/c" },
  ]
}

module "handler_module" {
  count = length(local.handlers)

  source = "./modules/aws-api-gateway-lambdas"

  lambda_repository_id = aws_s3_bucket.lambda_repository.id
  lambda_role_arn      = aws_iam_role.lambda_exec.arn

  api_gw_id            = aws_apigatewayv2_api.lambda_gateway.id
  api_gw_execution_arn = aws_apigatewayv2_api.lambda_gateway.execution_arn

  source_file = local.handlers[count.index].source_file
  method      = local.handlers[count.index].method
  route       = local.handlers[count.index].route
}
