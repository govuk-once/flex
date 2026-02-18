import { getStackName } from "@platform/gov-uk-once";
import * as cdk from "aws-cdk-lib";

import { FlexCertStack } from "./stacks/cert";
import { FlexPlatformStack } from "./stacks/core";
import { FlexDomainStack } from "./stacks/domain";
import { FlexInternalGatewayStack } from "./stacks/internalGateway";
import { getDomainConfigs } from "./utils/getDomainConfigs";
import { getDomainName } from "./utils/getDomainName";

const app = new cdk.App();

const { domainName, subdomainName } = await getDomainName();

const certStackName = getStackName("FlexCertStack");
const { certArnParamName } = new FlexCertStack(app, certStackName, {
  domainName,
  subdomainName,
});

const { restApi } = new FlexPlatformStack(app, getStackName("FlexPlatform"), {
  certArnParamName,
  domainName,
  subdomainName,
});

/**
 * Dynamically create CloudFormation stack per domain
 */
const flexDomains = await getDomainConfigs();
flexDomains.forEach((domain) => {
  new FlexDomainStack(app, getStackName(domain.domain), { domain, restApi });
});

new FlexInternalGatewayStack(app, getStackName("FlexInternalGateway"));
