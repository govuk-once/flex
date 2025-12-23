import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import {
  toSsmParameterName,
  type FlexStack,
  type FlexStage,
} from '@flex/utils';

interface FlexFunctionProps {
  readonly apiConfig: {
    readonly method: string;
    readonly path: string;
  };
  readonly entry: string;
  readonly stack: FlexStack;
  readonly stage: FlexStage;
  readonly environment?: {
    [key: string]: string;
  };
  readonly logRemovalPolicy?: cdk.RemovalPolicy;
  readonly logRetention?: logs.RetentionDays;
  readonly memorySize?: number;
  readonly runtime?: lambda.Runtime;
  readonly timeout?: cdk.Duration;
  readonly tracing?: lambda.Tracing;
}

export class FlexFunction extends Construct {
  public readonly lambdaFn: lambdaNodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: FlexFunctionProps) {
    super(scope, id);

    const {
      apiConfig,
      entry,
      stack,
      stage,
      environment = {},
      logRemovalPolicy = cdk.RemovalPolicy.DESTROY,
      logRetention = logs.RetentionDays.ONE_MONTH,
      memorySize = 128,
      runtime = lambda.Runtime.NODEJS_22_X,
      timeout = cdk.Duration.seconds(30),
      tracing = lambda.Tracing.ACTIVE,
    } = props;

    const method = apiConfig.method.toUpperCase();
    const routePath = apiConfig.path.trim().replace(/^\/+/, '');

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      removalPolicy: logRemovalPolicy,
      retention: logRetention,
    });

    this.lambdaFn = new lambdaNodejs.NodejsFunction(this, 'Handler', {
      entry,
      handler: 'handler',
      runtime,
      environment,
      logGroup,
      memorySize,
      timeout,
      tracing,
    });

    const apiId = ssm.StringParameter.valueForStringParameter(
      this,
      toSsmParameterName(stage, stack, 'platform', 'api-id'),
    );
    const apiRootId = ssm.StringParameter.valueForStringParameter(
      this,
      toSsmParameterName(stage, stack, 'platform', 'api-root-id'),
    );
    const apiStageName = ssm.StringParameter.valueForStringParameter(
      this,
      toSsmParameterName(stage, stack, 'platform', 'api-stage-name'),
    );

    const api = apigw.RestApi.fromRestApiAttributes(this, 'SharedApi', {
      restApiId: apiId,
      rootResourceId: apiRootId,
    });

    const resource = api.root.resourceForPath(routePath);

    resource.addMethod(
      method,
      new apigw.Integration({
        type: apigw.IntegrationType.AWS_PROXY,
        integrationHttpMethod: 'POST',
        uri: cdk.Stack.of(this).formatArn({
          service: 'apigateway',
          resource: 'lambda',
          resourceName: `path/2015-03-31/functions/${
            this.lambdaFn.functionArn
          }/invocations`,
        }),
      }),
    );

    this.lambdaFn.addPermission('InvokeByApiGateway', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: api.arnForExecuteApi(method, `/${routePath}`, apiStageName),
    });
  }
}
