import { getStackName } from "@platform/gov-uk-once";
import * as cdk from "aws-cdk-lib";

import { FlexCertStack } from "./stacks/cert";
import { FlexPlatformStack } from "./stacks/core";
import { FlexDomainStack } from "./stacks/domain";
import { FlexPrivateGatewayStack } from "./stacks/private-gateway";
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

const privateGateway = new FlexPrivateGatewayStack(
  app,
  getStackName("FlexPrivateGateway"),
);

/**
 * Dynamically create CloudFormation stack per domain
 */
const flexDomains = await getDomainConfigs();
const privateDomains = await getPrivateDomainConfigs();

const domainStacks = flexDomains.map(
  (domain) =>
    new FlexDomainStack(app, getStackName(domain.domain), {
    domain,
    privateApi: privateGateway.privateApiRef,
    privateDomain: privateDomains.get(domain.domain),
    }),
);

const publicRouteBindings = domainStacks.flatMap(
  (stack) => stack.publicRouteBindings,
);

new FlexPlatformStack(app, getStackName("FlexPlatform"), {
  certArnParamName,
  domainName,
  subdomainName,
  publicRouteBindings,
});
