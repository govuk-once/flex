import { getEnvConfig, getStackName } from "@platform/gov-uk-once";
import * as cdk from "aws-cdk-lib";

import { FlexCoreStack } from "./stack";

const app = new cdk.App();

const envConfig = getEnvConfig();

if (!envConfig.persistent) {
  throw new Error(
    "This is a persistent env and must be deployed with an approved ENVIRONMENT",
  );
}

new FlexCoreStack(app, { id: getStackName("FlexCore"), enableNat: true });
