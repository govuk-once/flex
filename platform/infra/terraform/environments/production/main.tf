module "flex_smoke_test_wif" {
  source = "../../modules/flex-smoke-test-wif"

  env                = local.env
  gcp_project_id     = local.gcp_project_id
  pool_id            = local.pool_id
  service_account_id = local.service_account_id
  provider_id        = local.provider_id
  env_tags           = local.env_tags
}
