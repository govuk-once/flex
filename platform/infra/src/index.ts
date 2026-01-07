import * as cdk from 'aws-cdk-lib';

import { FlexCoreStack } from './stacks/flex-core-stack';
import { FlexPlatformStack } from './stacks/flex-platform-stack';
import { getEnvConfig, getStackName } from './stacks/gov-uk-once-stack';

const app = new cdk.App();

const envConfig = getEnvConfig();

if (envConfig.persistent) {
  new FlexCoreStack(app, { id: getStackName('FlexCore'), enableNat: false });
}

new FlexPlatformStack(app, getStackName('FlexPlatform'));
