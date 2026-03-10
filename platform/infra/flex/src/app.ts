import { getStackName } from "@platform/gov-uk-once";
import * as cdk from "aws-cdk-lib";

import { FlexCertStack } from "./stacks/cert";
import { FlexPlatformStack } from "./stacks/core";
import { FlexDomainStack, FlexDomainStackPoC } from "./stacks/domain";
import { getDomainConfigs } from "./utils/getDomainConfigs";
import { getDomainName } from "./utils/getDomainName";

const app = new cdk.App();

const { domainName, subdomainName } = await getDomainName();

const certStackName = getStackName("FlexCertStack");

const { certArnParamName } = new FlexCertStack(app, certStackName, {
  domainName,
  subdomainName,
});

/**
 * Dynamically create CloudFormation stack per domain
 * Use `domain` env var to deploy a single domain (e.g., domain=hello)
 */
const targetDomain = process.env.domain;

// TODO: Reduce down to single list once PoC migration is complete
const domains = await getDomainConfigs();

const pocDomains = targetDomain
  ? domains.poc.filter((d) => d.name === targetDomain)
  : domains.poc;

const pocStacks = pocDomains.map(
  (config) =>
    new FlexDomainStackPoC(app, getStackName(config.name), {
      config,
      privateApi: privateGateway.privateApiRef,
    }),
);

const legacyDomains = targetDomain
  ? domains.endpoints.filter((d) => d.public.domain === targetDomain)
  : domains.endpoints;

const legacyStacks = legacyDomains.map(
  (configs) =>
    new FlexDomainStack(app, getStackName(configs.public.domain), {
      domain: configs.public,
      privateDomain: configs.private,
      privateApi: privateGateway.privateApiRef,
    }),
);

const publicRouteBindings = [
  ...pocStacks.flatMap((s) => s.publicRouteBindings),
  ...legacyStacks.flatMap((s) => s.publicRouteBindings),
];

if (targetDomain && pocDomains.length === 0 && legacyDomains.length === 0) {
  const available = [
    ...domains.poc.map((d) => d.name),
    ...domains.endpoints.map((d) => d.public.domain),
  ].join(", ");

  throw new Error(
    `Domain "${targetDomain}" not found. Available domains: ${available}`,
  );
}

new FlexPlatformStack(app, getStackName("FlexPlatform"), {
  certArnParamName,
  domainName,
  subdomainName,
  publicRouteBindings,
});
