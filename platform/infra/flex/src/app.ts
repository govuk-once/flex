import { getStackName } from "@platform/gov-uk-once";
import * as cdk from "aws-cdk-lib";

import { FlexDomainStack } from "./domainStack";
import { FlexPlatformStack } from "./stack";
import { loadDomainConfigs } from "./utils/getDomains";

const app = new cdk.App();
const domains = await loadDomainConfigs();

const flexPlatformStack = new FlexPlatformStack(
  app,
  getStackName("FlexPlatform"),
);

/**
 * Dynamical create CloudFormation stack per domain
 */
domains.forEach((domain) => {
  new FlexDomainStack(
    app,
    getStackName(domain.domain),
    domain,
    flexPlatformStack.httpApi,
  );
});
