import { Environment, getEnvConfig } from "@flex/utils";
import { Aspects } from "aws-cdk-lib";

import { EnforceS3Https } from "./aspects/enforce-s3-https";
import { SsmApp } from "./base";
import { ENV_KEYS, PLATFORM_KEYS } from "./ssm-keys";
import { FlexCertStack } from "./stacks/cert";
import { FlexCloudfrontAlarmsStack } from "./stacks/cloudfront-alarms";
import { FlexCoreStack } from "./stacks/core/stack";
import { FlexApiDeploymentStack } from "./stacks/deploy";
import { FlexDomainStack } from "./stacks/domain";
import { FlexPlatformStack } from "./stacks/platform";
import { getDeployableDomains } from "./utils/deployment";
import { getDomainConfigs } from "./utils/getDomainConfigs";
import { getDomainName } from "./utils/getDomainName";

const { env, persistent, stage } = getEnvConfig();
const { domainName, subdomainName } = await getDomainName();

const app = new SsmApp();
Aspects.of(app).add(new EnforceS3Https());

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
  // TODO: remove guard when DVLA and UNS are ready for production
  ...(env !== Environment.production
    ? [
        ENV_KEYS.DvlaConfigSecretArn,
        ENV_KEYS.UnsConfigSecretArn,
        ENV_KEYS.UnsCustomerRole,
      ]
    : []),
  ENV_KEYS.MonitoringSlackWorkspaceId,
  ENV_KEYS.MonitoringSlackChannelId,
  ENV_KEYS.FlexEncryptionKey,
]);

if (persistent) {
  new FlexCoreStack(app, `${env}-FlexCore`);
} else if (env === Environment.development) {
  // Add these as external deps as we reuse the development env vpc
  app.addExternalExports(region, [
    ENV_KEYS.CacheEndpoint,
    ENV_KEYS.SgPrivateEgress,
    ENV_KEYS.SgPrivateIsolated,
    ENV_KEYS.TopicCriticalAlarms,
    ENV_KEYS.TopicWarningAlarms,
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

new FlexCloudfrontAlarmsStack(app, `${stage}-FlexCloudfrontAlarms`);

const allDomainConfigs = await getDomainConfigs();
const deployableDomainConfigs = getDeployableDomains(allDomainConfigs, stage);

const targetDomain = process.env.domain;

const deployedDomains: string[] = [];
const domainStacks: FlexDomainStack[] = [];

for (const domain of deployableDomainConfigs) {
  if (targetDomain && targetDomain !== domain.name) continue;

  const stackName = `${stage}-${domain.name}`;

  const stack = new FlexDomainStack(app, stackName, domain, stage);

  domainStacks.push(stack);
  deployedDomains.push(stackName);
}

new FlexApiDeploymentStack(app, `${stage}-FlexApiDeployment`, {
  deployedDomains,
  publicRouteBindings: domainStacks.flatMap((s) => s.publicRouteBindings),
  privateRouteBindings: domainStacks.flatMap((s) => s.privateRouteBindings),
});
