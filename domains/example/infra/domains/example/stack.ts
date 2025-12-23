import * as url from 'node:url';
import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { FlexFunction } from '@flex/infra';
import type { FlexEnvironmentConfig } from '@flex/utils';

const handlersPath = path.join(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '../../../src/handlers',
);

interface ExampleDomainStackProps
  extends cdk.StackProps,
    Pick<FlexEnvironmentConfig, 'stack' | 'stage'> {}

export class ExampleDomainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ExampleDomainStackProps) {
    super(scope, id, props);

    const { stack, stage } = props;

    new FlexFunction(this, 'HelloWorldLambda', {
      entry: path.join(handlersPath, 'example/get.ts'),
      apiConfig: {
        method: 'GET',
        path: 'example/hello',
      },
      stack,
      stage,
    });
  }
}
