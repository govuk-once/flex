import * as cdk from "aws-cdk-lib";

import { FlexCoreStack } from "./stacks/flex-core-stack";
import { FlexParameterStack } from "./stacks/flex-parameter-stack";
import { FlexPlatformStack } from "./stacks/flex-platform-stack";
import { getEnvConfig, getStackName } from "./stacks/gov-uk-once-stack";

const app = new cdk.App();

const envConfig = getEnvConfig();

let coreStack: FlexCoreStack | undefined;
let parameterStack: FlexParameterStack | undefined;
if (envConfig.persistent) {
  coreStack = new FlexCoreStack(app, {
    id: getStackName("FlexCore"),
    enableNat: false,
  });
  // TODO: move to separate repo, values will be replaced upon re-deploy
  parameterStack = new FlexParameterStack(app, getStackName("FlexParameter"));
}

const platformStack = new FlexPlatformStack(app, getStackName("FlexPlatform"));

// Ensure the network stack is deployed first via the pipeline
if (coreStack) {
  platformStack.addDependency(coreStack);
}

if (parameterStack) {
  platformStack.addDependency(parameterStack);
}
