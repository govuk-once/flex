import type { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import {
  type FlexEnvironmentConfig,
  toSsmParameterName,
  toCfnExportName,
} from '@flex/utils';

import { DEFAULT_CORS_OPTIONS, createDeployOptions } from '../utils';

interface FlexPlatformStackProps
  extends cdk.StackProps,
    Pick<FlexEnvironmentConfig, 'stack' | 'stage'> {}

export class FlexPlatformStack extends cdk.Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: FlexPlatformStackProps) {
    super(scope, id, props);

    const { stack, stage } = props;

    const api = new apigw.RestApi(this, 'FlexPlatformApi', {
      restApiName: 'Flex Platform API',
      description: 'Central API Gateway for the Flex Platform',
      defaultCorsPreflightOptions: DEFAULT_CORS_OPTIONS,
      deployOptions: createDeployOptions(stage),
      endpointTypes: [apigw.EndpointType.REGIONAL],
    });

    this.apiUrl = api.url;
    this.addHealthEndpoint(api);
    this.addHttpsOnlyPolicy(api);

    [
      {
        id: 'FlexPlatformApiIdParam',
        props: {
          stringValue: api.restApiId,
          description: 'The REST API ID of the Flex API Gateway',
          parameterName: toSsmParameterName(stage, stack, 'platform', 'api-id'),
        },
      },
      {
        id: 'FlexPlatformApiRootIdParam',
        props: {
          stringValue: api.restApiRootResourceId,
          description: 'The Root Resource ID of the Flex API Gateway',
          parameterName: toSsmParameterName(
            stage,
            stack,
            'platform',
            'api-root-id',
          ),
        },
      },
      {
        id: 'FlexPlatformApiUrlParam',
        props: {
          stringValue: api.url,
          description: 'The base URL of the Flex Platform API Gateway',
          parameterName: toSsmParameterName(
            stage,
            stack,
            'platform',
            'api-url',
          ),
        },
      },
      {
        id: 'FlexPlatformApiStageNameParam',
        props: {
          stringValue: api.deploymentStage.stageName,
          description:
            'The deployment stage name of the Flex Platform API Gateway',
          parameterName: toSsmParameterName(
            stage,
            stack,
            'platform',
            'api-stage-name',
          ),
        },
      },
    ].forEach(({ id, props }) => new ssm.StringParameter(this, id, props));

    new cdk.CfnOutput(this, 'FlexPlatformApiUrl', {
      value: api.url,
      description: 'The base URL of the Flex Platform API Gateway',
      exportName: toCfnExportName(stage, stack, 'api-url'),
    });
  }

  private addHealthEndpoint(api: apigw.RestApi) {
    api.root.addResource('health').addMethod(
      'GET',
      new apigw.MockIntegration({
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': JSON.stringify({
                status: 'ok',
                timestamp: '$context.requestTime',
                requestId: '$context.requestId',
              }),
            },
          },
        ],
        requestTemplates: {
          'application/json': JSON.stringify({ statusCode: 200 }),
        },
      }),
      { methodResponses: [{ statusCode: '200' }] },
    );
  }

  private addHttpsOnlyPolicy(api: apigw.RestApi) {
    api.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ['execute-api:Invoke'],
        resources: [
          api.arnForExecuteApi('*', '/*', api.deploymentStage.stageName),
        ],
        conditions: { Bool: { 'aws:SecureTransport': 'false' } },
      }),
    );
  }
}
