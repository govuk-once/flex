import { getStackName } from "@platform/gov-uk-once";
import * as cdk from "aws-cdk-lib";

import { FlexCertStack } from "./stacks/cert";
import { FlexPlatformStack } from "./stacks/core";
import { FlexDomainStack } from "./stacks/domain";
import { FlexPrivateGatewayStack } from "./stacks/serviceGateway";
import { getDomainConfigs } from "./utils/getDomainConfigs";
import { getDomainName } from "./utils/getDomainName";

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

const flexDomains = await getDomainConfigs();

const flexPrivateGatewayStack = new FlexPrivateGatewayStack(
  app,
  getStackName("FlexPrivateGateway"),
  { domains: flexDomains, httpApi },
);

flexDomains.forEach((domain) => {
  const stack = new FlexDomainStack(app, getStackName(domain.domain), {
    domain,
    httpApi,
    domainsResource: flexPrivateGatewayStack.domainsResource,
  });

  if (domain.public) {
    stack.processRoutes(domain.public);
  }
});
