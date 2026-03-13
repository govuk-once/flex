import { getEnvConfig } from "./base/env";

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
  UdpConfigSecretArn: `/${env}/flex-param/udp/consumer-config-secret-arn`,
  UdpConfigRoleArn: `/${env}/flex-param/udp/consumer-role-arn`,
  UdpCmkArn: `/${env}/flex-param/udp/cmk-arn`,
  Vpc: `/${env}/flex/vpc`,
  VpcEApiGateway: `/${env}/flex/vpc-e/api-gateway`,
};

export const STAGE_KEYS = {
  ApigwPublicRestId: `/${stage}/flex/apigw/public/rest-api-id`,
  ApigwPublicRoot: `/${stage}/flex/apigw/public/root`,
  ApigwPublicAuthorizerFn: `/${stage}/flex/apigw/public/authorizer-fn`,
  ApigwPrivateRestId: `/${stage}/flex/apigw/private/rest-api-id`,
  ApigwPrivateDomainRoot: `/${stage}/flex/apigw/private/domains-root`,
  ApigwPrivateGatewayUrl: `/${stage}/flex/apigw/private/gateway-url`,
  CertArn: `/${stage}/cert/cert-arn`,
};
