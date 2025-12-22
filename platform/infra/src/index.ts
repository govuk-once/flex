import * as cdk from 'aws-cdk-lib';

import { FlexPlatformStack } from './lib/stacks/flex-platform-stack';
import { getEnvironmentConfig, ResourceTaggingAspect } from './lib/utils';

const app = new cdk.App();

const { environment, environmentTag, stackName } = getEnvironmentConfig();

const stack = new FlexPlatformStack(app, `FlexPlatformStack${stackName}`, {
  environment,
});

cdk.Aspects.of(stack).add(
  new ResourceTaggingAspect({
    Product: 'GOV.UK Once',
    System: 'Flex',
    Environment: environmentTag,
    Owner: '',
  }),
);
