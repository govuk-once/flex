variable "message" {}

resource "local_file" "file" {
  content  = var.message
  filename = "${path.module}/hi.txt"
}