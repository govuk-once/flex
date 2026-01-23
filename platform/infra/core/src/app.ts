import { getEnvConfig, getStackName } from "@platform/gov-uk-once";
import * as cdk from "aws-cdk-lib";

import { FlexCoreStack } from "./stack";

const { persistent } = getEnvConfig();

if (!persistent) {
  throw new Error(
    "Skipping deployment: This is a persistent stack and will only be deployed when STAGE is set to an approved stack",
  );
}

const app = new cdk.App();

new FlexCoreStack(app, getStackName("FlexCore"));
