import { getStackName } from "@platform/gov-uk-once";
import * as cdk from "aws-cdk-lib";

import { FlexPlatformStack } from "./stack";
import { loadDomainConfigs } from "./utils/getDomains";

const app = new cdk.App();

new FlexPlatformStack(
  app,
  getStackName("FlexPlatform"),
  await loadDomainConfigs(),
);
