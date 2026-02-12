import { getStackName } from "@platform/gov-uk-once";
import * as cdk from "aws-cdk-lib";

import { FlexCertStack } from "./certStack";
import { FlexDomainStack } from "./domainStack";
import { FlexPlatformStack } from "./stack";
import { getDns } from "./utils/getDns";
import { loadDomainConfigs } from "./utils/getDomains";

const app = new cdk.App();

const [domainConfig, domains] = await Promise.all([
  getDns(),
  loadDomainConfigs(),
]);

const { certArn } = new FlexCertStack(app, getStackName("FlexCertStack"), {
  domainConfig,
});

const { httpApi } = new FlexPlatformStack(app, getStackName("FlexPlatform"), {
  domainConfig: {
    ...domainConfig,
    certArn,
  },
});

/**
 * Dynamical create CloudFormation stack per domain
 */
domains.forEach((domain) => {
  new FlexDomainStack(app, getStackName(domain.domain), domain, httpApi);
});
