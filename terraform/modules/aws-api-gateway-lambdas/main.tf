data "archive_file" "this" {
  type        = "zip"
  source_file = var.source_file
  output_path = replace(var.source_file, ".js", ".zip")
}

locals {
  hash = filemd5(data.archive_file.this.output_path)
}

resource "aws_s3_object" "this" {
  bucket = var.lambda_repository_id
  key    = "${local.hash}.zip"
  source = data.archive_file.this.output_path
  etag   = filemd5(data.archive_file.this.output_path)
}

resource "aws_lambda_function" "this" {
  function_name = local.hash

  s3_bucket = var.lambda_repository_id
  s3_key    = aws_s3_object.this.key

  runtime = "nodejs22.x"
  handler = "${lower(var.method)}.handler"

  source_code_hash = data.archive_file.this.output_base64sha256

  role = var.lambda_role_arn
}

resource "aws_lambda_permission" "this" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${var.api_gw_execution_arn}/*/*"
}

resource "aws_cloudwatch_log_group" "this" {
  name = "/aws/lambda/${aws_lambda_function.this.function_name}"

  retention_in_days = 30
}

resource "aws_apigatewayv2_integration" "this" {
  api_id = var.api_gw_id

  integration_uri        = aws_lambda_function.this.invoke_arn
  integration_type       = "AWS_PROXY"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "this" {
  api_id = var.api_gw_id

  route_key = "${var.method} ${var.route}"
  target    = "integrations/${aws_apigatewayv2_integration.this.id}"
}


