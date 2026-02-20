import { getStackName } from "@platform/gov-uk-once";
import * as cdk from "aws-cdk-lib";

import { FlexCertStack } from "./stacks/cert";
import { FlexPlatformStack } from "./stacks/core";
import { FlexDomainStack } from "./stacks/domain";
import { getDomainConfigs } from "./utils/getDomainConfigs";
import { getDomainName } from "./utils/getDomainName";

const app = new cdk.App();

const { domainName, subdomainName } = await getDomainName();

const certStackName = getStackName("FlexCertStack");
const certStack = new FlexCertStack(app, certStackName, {
  domainName,
  subdomainName,
});

const platformStack = new FlexPlatformStack(app, getStackName("FlexPlatform"), {
  certArnParamName: certStack.certArnParamName,
  domainName,
  subdomainName,
});
platformStack.addDependency(certStack);

/**
 * Dynamically create CloudFormation stack per domain
 */
const flexDomains = await getDomainConfigs();
flexDomains.forEach((domain) => {
  const domainStack = new FlexDomainStack(app, getStackName(domain.domain), {
    domain,
    restApi: platformStack.restApi,
  });
  domainStack.addDependency(platformStack);
});
