import { getStackName } from "@platform/gov-uk-once";
import * as cdk from "aws-cdk-lib";

import { FlexCertStack } from "./stacks/cert";
import { FlexPlatformStack } from "./stacks/core";
import { FlexDomainStack } from "./stacks/domain";
import { getDomainConfigs } from "./utils/getDomainConfigs";
import { getDomainName } from "./utils/getDomainName";
import { FlexPrivateDomainStack } from "./privateDomainStack";
import { FlexPrivateGatewayStack } from "./serviceGatewayStack";

const app = new cdk.App();

const { domainName, subdomainName } = await getDomainName();

const { certArn } = new FlexCertStack(app, getStackName("FlexCertStack"), {
  domainName,
  subdomainName,
});

const { httpApi } = new FlexPlatformStack(app, getStackName("FlexPlatform"), {
  certArn,
  domainName,
  subdomainName,
});

/**
 * Step 2: Dynamically create CloudFormation stack per domain (Lambdas only)
 */
const flexDomains = await getDomainConfigs();
flexDomains.forEach((domain) => {
  new FlexDomainStack(app, getStackName(domain.domain), { domain, httpApi });
});

/**
 * Step 3: Create private gateway stack (depends on domain stacks)
 * This wires private routes to RestApi and grants IAM permissions
 */
const flexPrivateGatewayStack = new FlexPrivateGatewayStack(
  app,
  getStackName("FlexPrivateGateway"),
);

flexDomains.forEach((domain) => {
    new FlexPrivateDomainStack(
      app,
      getStackName(`${domain.domain}Private`),
      domain,
      httpApi,
      flexPrivateGatewayStack.domainsResource,
    );
});
