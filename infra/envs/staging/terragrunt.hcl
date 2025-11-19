locals {
  account_vars = read_terragrunt_config("account.hcl")
}

include {
  path = find_in_parent_folders("root.hcl")
}
