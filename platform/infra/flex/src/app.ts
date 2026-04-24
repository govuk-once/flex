import { SsmApp } from "./base";
import { Environment, getEnvConfig } from "./base/env";
import { ENV_KEYS, PLATFORM_KEYS } from "./ssm-keys";
import { FlexCertStack } from "./stacks/cert";
import { FlexCoreStack } from "./stacks/core/stack";
import { FlexApiDeploymentStack } from "./stacks/deploy";
import { FlexDomainStack } from "./stacks/domain";
import { FlexPlatformStack } from "./stacks/platform";
import { getDomainConfigs } from "./utils/getDomainConfigs";
import { getDomainName } from "./utils/getDomainName";

const { env, persistent, stage } = getEnvConfig();
const { domainName, subdomainName } = await getDomainName();

const app = new SsmApp();
const region = "eu-west-2";

app.addExternalExports(region, [
  // Provided by platform team
  PLATFORM_KEYS.HostedZoneId,
  PLATFORM_KEYS.HostedZoneName,
  // Provided by flex-params repo
  ENV_KEYS.AuthClientId,
  ENV_KEYS.AuthClientIdStub,
  ENV_KEYS.AuthUserPoolId,
  ENV_KEYS.AuthUserPoolIdStub,
  ENV_KEYS.UdpCmkArn,
  ENV_KEYS.UdpConfigRoleArn,
  ENV_KEYS.UdpConfigSecretArn,
  ENV_KEYS.DvlaConfigSecretArn,
  ENV_KEYS.UnsConfigSecretArn,
]);

if (persistent) {
  new FlexCoreStack(app, `${env}-FlexCore`);
} else if (env === Environment.DEVELOPMENT) {
  // Add these as external deps as we reuse the development env vpc
  app.addExternalExports(region, [
    ENV_KEYS.CacheEndpoint,
    ENV_KEYS.SgPrivateEgress,
    ENV_KEYS.SgPrivateIsolated,
    ENV_KEYS.VpcEApiGateway,
    // Vpc exports are extensive
    `${ENV_KEYS.Vpc}/vpc-id`,
    `${ENV_KEYS.Vpc}/vpc-cidr`,
    `${ENV_KEYS.Vpc}/availability-zones`,
    `${ENV_KEYS.Vpc}/public-subnet-ids`,
    `${ENV_KEYS.Vpc}/public-subnet-route-table-ids`,
    `${ENV_KEYS.Vpc}/private-subnet-ids`,
    `${ENV_KEYS.Vpc}/private-subnet-route-table-ids`,
    `${ENV_KEYS.Vpc}/isolated-subnet-ids`,
    `${ENV_KEYS.Vpc}/isolated-subnet-route-table-ids`,
  ]);
}

new FlexCertStack(app, `${stage}-FlexCertStack`, {
  domainName,
  subdomainName,
});

new FlexPlatformStack(app, `${stage}-FlexPlatform`, {
  domainName,
  subdomainName,
});

const domainConfigs = await getDomainConfigs();
const targetDomain = process.env.domain;

const deployedDomains: string[] = [];
const domainStacks: FlexDomainStack[] = [];

for (const domainConfig of domainConfigs) {
  const domainName = domainConfig.name;
  if (targetDomain && targetDomain !== domainName) continue;

  const stackName = `${stage}-${domainName}`;
  const stack = new FlexDomainStack(app, stackName, domainConfig);
  domainStacks.push(stack);
  deployedDomains.push(stackName);
}

new FlexApiDeploymentStack(app, `${stage}-FlexApiDeployment`, {
  deployedDomains,
  publicRouteBindings: domainStacks.flatMap((s) => s.publicRouteBindings),
  privateRouteBindings: domainStacks.flatMap((s) => s.privateRouteBindings),
});
