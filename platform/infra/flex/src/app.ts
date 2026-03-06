import { SsmApp } from "./base";
import { Environment, getEnvConfig } from "./base/env";
import { FlexCertStack } from "./stacks/cert";
import { FlexCoreStack } from "./stacks/core/stack";
import { FlexDomainStack } from "./stacks/domain";
import { FlexPlatformStack } from "./stacks/platform";
import {
  getDomainConfigs,
  getPrivateDomainConfigs,
} from "./utils/getDomainConfigs";
import { getDomainName } from "./utils/getDomainName";

const { env, persistent, stage } = getEnvConfig();

const app = new SsmApp();
const region = "eu-west-2";

app.addExternalExports(region, [
  // Provided by platform team
  "/infra/dns/hostedzoneid",
  "/infra/dns/hostedzonename",
  // Provided by flex-params repo
  `/${env}/flex-param/auth/client-id`,
  `/${env}/flex-param/auth/user-pool-id`,
  `/${env}/flex-param/auth/stub/client-id`,
  `/${env}/flex-param/auth/stub/user-pool-id`,
  `/${env}/flex-param/udp/cmk-arn`,
  `/${env}/flex-param/udp/consumer-config-secret-arn`,
  `/${env}/flex-param/udp/consumer-role-arn`,
]);

const { domainName, subdomainName } = await getDomainName();

if (persistent) {
  new FlexCoreStack(app, `${env}-FlexCore`);
} else if (env === Environment.DEVELOPMENT) {
  // Add these as external deps as we reuse the development env vpc
  app.addExternalExports(region, [
    `/${env}/flex/vpc`,
    `/${env}/flex/sg/private-egress`,
    `/${env}/flex/sg/private-isolated`,
    `/${env}/flex/vpc-e/api-gateway`,
    `/${env}/flex/cache/endpoint`,
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

/**
 * Dynamically create CloudFormation stack per domain
 * Use `domain` env var to deploy a single domain (e.g., domain=hello)
 */
async function getPublicDomainConfigs() {
  const allDomains = await getDomainConfigs();

  const targetDomain = process.env.domain;
  if (!targetDomain) return allDomains;

  const domain = allDomains.find((d) => d.domain === targetDomain);
  if (domain) return [domain];

  const available = allDomains.map((d) => d.domain).join(", ");
  throw new Error(
    `Domain '${targetDomain}' not found. Available domains: ${available}`,
  );
}

const publicDomains = await getPublicDomainConfigs();
const privateDomains = await getPrivateDomainConfigs();

publicDomains.map((domain) => {
  new FlexDomainStack(app, `${stage}-${domain.domain}`, {
    domain,
    privateDomain: privateDomains.get(domain.domain),
  });
});
