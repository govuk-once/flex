import * as url from 'node:url';
import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { FlexFunction } from '@flex/infra';

const handlersPath = path.join(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '../../../src/handlers',
);

interface ExampleDomainStackProps extends cdk.StackProps {
  readonly stage: string;
}

export class ExampleDomainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ExampleDomainStackProps) {
    super(scope, id, props);

    const { stage } = props;

    const helloWorldFunction = new FlexFunction(this, 'HelloWorld', {
      stage,
      apiRoute: {
        method: 'GET',
        path: 'example/hello',
      },
      function: {
        entry: path.join(handlersPath, 'example/get.ts'),
      },
    });

    new cdk.CfnOutput(this, 'HelloWorldEndpoint', {
      value: helloWorldFunction.endpointUrl,
      description: `${helloWorldFunction.httpMethod} /${helloWorldFunction.resourcePath}`,
    });

    new cdk.CfnOutput(this, 'HelloWorldFunctionName', {
      value: helloWorldFunction.lambdaFn.functionName,
      description: 'Hello World Lambda function name',
    });

    new cdk.CfnOutput(this, 'HelloWorldLogGroup', {
      value: helloWorldFunction.logGroup.logGroupName,
      description: 'Hello World Lambda CloudWatch Log Group',
    });

    new cdk.CfnOutput(this, 'HelloWorldTestCommand', {
      value: `curl -X ${helloWorldFunction.httpMethod} "${helloWorldFunction.endpointUrl}"`,
      description: 'Test the Hello World Lambda endpoint',
    });
  }
}
