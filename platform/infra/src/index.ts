import * as cdk from "aws-cdk-lib";

import { FlexCoreStack } from "./stacks/flex-core-stack";
import { FlexPlatformStack } from "./stacks/flex-platform-stack";
import { getEnvConfig, getStackName } from "./stacks/gov-uk-once-stack";

const app = new cdk.App();

const envConfig = getEnvConfig();

let coreStack: FlexCoreStack | undefined;
if (envConfig.persistent) {
  coreStack = new FlexCoreStack(app, {
    id: getStackName("FlexCore"),
    enableNat: false,
  });
}

const platformStack = new FlexPlatformStack(app, getStackName("FlexPlatform"));

// Ensure the network stack is deployed first via the pipeline
if (coreStack) {
  platformStack.addDependency(coreStack);
}
