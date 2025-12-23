import * as cdk from 'aws-cdk-lib';
import { ExampleDomainStack } from 'domains/example/infra/domains/example/stack';

import { FlexPlatformStack } from './lib/stacks/flex-platform-stack';
import { getFlexEnvironmentConfig, ResourceTaggingAspect } from './lib/utils';

const app = new cdk.App();

const { envTag, stack, stage } = getFlexEnvironmentConfig();

const flexPlatformStack = new FlexPlatformStack(
  app,
  `FlexPlatformStack-${stage}`,
  { stack, stage },
);

cdk.Aspects.of(flexPlatformStack).add(
  new ResourceTaggingAspect({
    Product: 'GOV.UK',
    System: 'Flex',
    Environment: envTag,
    Owner: 'test@digital.cabinet-office.gov.uk',
  }),
);

const exampleDomainStack = new ExampleDomainStack(
  app,
  `ExampleDomainStack-${stage}`,
  { stack, stage },
);

cdk.Aspects.of(exampleDomainStack).add(
  new ResourceTaggingAspect({
    Product: 'GOV.UK',
    System: 'Flex',
    Environment: envTag,
    Owner: 'test@digital.cabinet-office.gov.uk',
  }),
);
exampleDomainStack.addDependency(flexPlatformStack);
