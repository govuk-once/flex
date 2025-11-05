terraform {
  source = "../shared"
}

dependency "foo" {
  config_path = "../foo"
  mock_outputs = {
    content = "Mocked content from foo"
  }
}

inputs = {
  message = "Foo content: ${dependency.foo.outputs.content}"
}