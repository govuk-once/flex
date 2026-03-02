import { getStackName } from "@platform/gov-uk-once";
import * as cdk from "aws-cdk-lib";

import { FlexCertStack } from "./stacks/cert";
import { FlexPlatformStack } from "./stacks/core";
import { FlexPrivateDomainStack } from "./stacks/private-domain";
import { FlexPrivateGatewayStack } from "./stacks/private-gateway";
import { FlexPublicDomainStack } from "./stacks/public-domain";
import {
  getDomainConfigs,
  getPrivateDomainConfigs,
} from "./utils/getDomainConfigs";
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

const allDomains = await getDomainConfigs();
const privateDomains = await getPrivateDomainConfigs();

const flexDomains = targetDomain
  ? allDomains.filter((d) => d.domain === targetDomain)
  : allDomains;

if (targetDomain && flexDomains.length === 0) {
  const available = allDomains.map((d) => d.domain).join(", ");
  throw new Error(
    `Domain '${targetDomain}' not found. Available domains: ${available}`,
  );
}

// Public domain stacks — one per domain config
const publicDomainStacks = flexDomains.map(
  (domain) =>
    new FlexPublicDomainStack(
      app,
      getStackName(`${domain.domain}-public`),
      { domain },
    ),
);

// Private domain stacks — one per private domain config, filtered by targetDomain
const privateDomainStacks = [...privateDomains.values()]
  .filter((d) => !targetDomain || d.domain === targetDomain)
  .map(
    (domain) =>
      new FlexPrivateDomainStack(
        app,
        getStackName(`${domain.domain}-private`),
        { domain },
      ),
  );

const publicRouteBindings = publicDomainStacks.flatMap(
  (stack) => stack.publicRouteBindings,
);
const privateRouteBindings = privateDomainStacks.flatMap(
  (stack) => stack.privateRouteBindings,
);

// Private gateway instantiated AFTER domain stacks — receives all route
// bindings so they land in the same CDK construct tree as the RestApi.
// This ensures CDK's auto-deployment hash includes all domain routes.
new FlexPrivateGatewayStack(app, getStackName("FlexPrivateGateway"), {
  privateRouteBindings,
});

new FlexPlatformStack(app, getStackName("FlexPlatform"), {
  certArnParamName,
  domainName,
  subdomainName,
  publicRouteBindings,
});
