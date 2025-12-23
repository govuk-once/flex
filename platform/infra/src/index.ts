import * as cdk from 'aws-cdk-lib';
import { getEnvironmentConfig, ResourceTaggingAspect } from '@flex/utils';

import { ExampleDomainStack } from 'domains/example/infra/stack';
import { FlexPlatformStack } from './lib/stacks/flex-platform-stack';

const app = new cdk.App();

const { stage, environment } = getEnvironmentConfig();

const TAGS = {
  Product: 'GOV.UK Once',
  System: 'Flex',
  Environment: environment,
  Owner: 'test@digital.cabinet-office.gov.uk',
};

const flexPlatformStack = new FlexPlatformStack(
  app,
  `FlexPlatformStack-${stage}`,
  { stage },
);

cdk.Aspects.of(flexPlatformStack).add(new ResourceTaggingAspect(TAGS), {
  priority: 100, // Priority: lower number = higher priority, must be < 200 (default Tag priority)
});

const exampleDomainStack = new ExampleDomainStack(
  app,
  `ExampleDomainStack-${stage}`,
  { stage },
);

cdk.Aspects.of(exampleDomainStack).add(new ResourceTaggingAspect(TAGS), {
  priority: 100,
});

exampleDomainStack.addDependency(flexPlatformStack);
