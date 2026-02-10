import { getStackName } from "@platform/gov-uk-once";
import * as cdk from "aws-cdk-lib";

import { FlexCertStack } from "./stacks/cert";
import { FlexPlatformStack } from "./stacks/core";
import { FlexDomainStackPoC } from "./stacks/domain";
import { FlexPrivateGatewayStack } from "./stacks/private-gateway";
import { getDomainConfigs } from "./utils/getDomainConfigs";
import { getDomainName } from "./utils/getDomainName";

const app = new cdk.App();

const { domainName, subdomainName } = await getDomainName();

const certStackName = getStackName("FlexCertStack");

const { certArnParamName } = new FlexCertStack(app, certStackName, {
  domainName,
  subdomainName,
});

const privateGateway = new FlexPrivateGatewayStack(
  app,
  getStackName("FlexPrivateGateway"),
);

/**
 * Dynamically create CloudFormation stack per domain
 * Use `domain` env var to deploy a single domain (e.g., domain=hello)
 */
const targetDomain = process.env.domain;

const domains = await getDomainConfigs();

// TODO: Handle both poc/existing domains, for now just working with poc domains
const flexDomains = targetDomain
  ? domains.poc.filter((d) => d.name === targetDomain)
  : domains.poc;

if (targetDomain && flexDomains.length === 0) {
  const available = domains.poc.map((d) => d.name).join(", ");

  throw new Error(
    `Domain '${targetDomain}' not found. Available domains: ${available}`,
  );
}

// TODO: Remove when poc migration complete
const domainStacks = flexDomains.map((config) => {
  return new FlexDomainStackPoC(app, getStackName(config.name), {
    config,
    privateApi: privateGateway.privateApiRef,
  });
});

const publicRouteBindings = domainStacks.flatMap((s) => s.publicRouteBindings);

// const domainStacks = flexDomains.map(
//   (domain) =>
//     new FlexDomainStack(app, getStackName(domain.domain), {
//       domain,
//       privateApi: privateGateway.privateApiRef,
//       privateDomain: privateDomains.get(domain.domain),
//     }),
// );

new FlexPlatformStack(app, getStackName("FlexPlatform"), {
  certArnParamName,
  domainName,
  subdomainName,
  publicRouteBindings,
});
