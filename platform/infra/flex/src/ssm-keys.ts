import { getEnvConfig } from "@flex/utils";

const { env, stage } = getEnvConfig();

export const PLATFORM_KEYS = {
  HostedZoneId: "/infra/dns/hostedzoneid",
  HostedZoneName: "/infra/dns/hostedzonename",
} as const;

export const ENV_KEYS = {
  AuthClientId: `/${env}/flex-param/auth/client-id`,
  AuthClientIdStub: `/${env}/flex-param/auth/stub/client-id`,
  AuthUserPoolId: `/${env}/flex-param/auth/user-pool-id`,
  AuthUserPoolIdStub: `/${env}/flex-param/auth/stub/user-pool-id`,
  CacheEndpoint: `/${env}/flex/cache/endpoint`,
  SgPrivateEgress: `/${env}/flex/sg/private-egress`,
  SgPrivateIsolated: `/${env}/flex/sg/private-isolated`,
  TopicCriticalAlarms: `/${env}/flex/topic/critical-alarms`,
  TopicWarningAlarms: `/${env}/flex/topic/warning-alarms`,
  DvlaConfigSecretArn: `/${env}/flex-param/dvla/consumer-config-secret-arn`,
  UnsConfigSecretArn: `/${env}/flex-param/uns/consumer-config-secret-arn`,
  UdpConfigSecretArn: `/${env}/flex-param/udp/consumer-config-secret-arn`,
  UdpConfigRoleArn: `/${env}/flex-param/udp/consumer-role-arn`,
  UdpCmkArn: `/${env}/flex-param/udp/cmk-arn`,
  MonitoringSlackWorkspaceId: `/${env}/flex-param/monitoring/slackWorkspaceId`,
  MonitoringSlackChannelId: `/${env}/flex-param/monitoring/slackChannelId`,
  FlexEncryptionKey: `/${env}/flex-param/secret/encryption-key`,
  Vpc: `/${env}/flex/vpc`,
  VpcEApiGateway: `/${env}/flex/vpc-e/api-gateway`,
};

export const SMOKE_TEST_KEYS = {
  GcpCredentialConfig: `/${env}/flex/smoke-test/gcp-credential-config`,
  GcpServiceAccountEmail: `/${env}/flex/smoke-test/gcp-service-account-email`,
  GcpProjectNumber: `/${env}/flex/smoke-test/gcp-project-number`,
  FirebaseAppId: `/${env}/flex/smoke-test/firebase-app-id`,
  AuthUrl: `/${env}/flex/smoke-test/auth-url`,
  ClientId: `/${env}/flex/smoke-test/client-id`,
  RedirectUri: `/${env}/flex/smoke-test/redirect-uri`,
  OneLoginEnvironment: `/${env}/flex/smoke-test/onelogin-environment`,
  ApiUrl: `/${env}/flex/smoke-test/api-url`,
  UserSecret: `/${env}/flex/smoke-test/user`,
} as const;

export const STAGE_KEYS = {
  ApigwPublicRestId: `/${stage}/flex/apigw/public/rest-api-id`,
  ApigwPublicAppRoot: `/${stage}/flex/apigw/public/app-root`,
  ApigwPublicAuthorizerFn: `/${stage}/flex/apigw/public/authorizer-fn`,
  //
  ApigwPrivateRestId: `/${stage}/flex/apigw/private/rest-api-id`,
  ApigwPrivateDomainRoot: `/${stage}/flex/apigw/private/domains-root`,
  ApigwPrivateGatewaysRoot: `/${stage}/flex/apigw/private/gateways-root`,
  ApigwPrivateGatewayUrl: `/${stage}/flex/apigw/private/gateway-url`,
  //
  CertArn: `/${stage}/cert/cert-arn`,
  //
  CloudfrontId: `/${stage}/flex/cloudfront/distribution-id`,
  CloudfrontFunctionName: `/${stage}/flex/cloudfront/function-name`,
  CloudfrontFunctionArn: `/${stage}/flex/cloudfront/function-arn`,
};
