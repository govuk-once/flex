import { getEnvConfig, getStackName } from "@platform/gov-uk-once";
import * as cdk from "aws-cdk-lib";

import { FlexCoreStack } from "./stack";

const { persistent } = getEnvConfig();

if (!persistent) {
  console.log(
    "Skipping deployment: This is a persistent stack and will only be deployed when STAGE is set to an approved stack",
  );
  process.exit(0);
}

const app = new cdk.App();
// test2
new FlexCoreStack(app, getStackName("FlexCore"));
