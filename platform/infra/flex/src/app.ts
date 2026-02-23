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

const platformStack = new FlexPlatformStack(app, getStackName("FlexPlatform"), {
  certArnParamName,
  domainName,
  subdomainName,
});

/**
 * Dynamically create CloudFormation stack per domain
 */
const flexDomains = await getDomainConfigs();
const privateDomains = await getPrivateDomainConfigs();

flexDomains.map(
  (domain) =>
    new FlexDomainStack(app, getStackName(domain.domain), {
      domain,
      publicApi: platformStack.publicApiRef,
      privateApi: privateGateway.privateApiRef,
      privateDomain: privateDomains.get(domain.domain),
    }),
);
