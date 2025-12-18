import type { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as apigw from 'aws-cdk-lib/aws-apigateway';

import type { Environment } from '../types';
import { DEFAULT_CORS_OPTIONS, DEFAULT_DEPLOY_OPTIONS } from '../utils';

interface FlexPlatformStackProps extends cdk.StackProps {
  readonly environment: Environment;
}

export class FlexPlatformStack extends cdk.Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: FlexPlatformStackProps) {
    super(scope, id, props);

    const { environment } = props;

    const api = new apigw.RestApi(this, 'FlexPlatformApi', {
      restApiName: 'Flex Platform API',
      description: 'Central API Gateway for the Flex Platform',
      defaultCorsPreflightOptions: DEFAULT_CORS_OPTIONS,
      deployOptions: DEFAULT_DEPLOY_OPTIONS,
      endpointTypes: [apigw.EndpointType.REGIONAL],
    });

    this.apiUrl = api.url;
    this.addHealthEndpoint(api);

    const ssmBasePath = `/${environment}/flex/platform`;

    [
      {
        id: 'FlexPlatformApiIdParam',
        props: {
          stringValue: api.restApiId,
          description: 'The REST API ID of the Flex API Gateway',
          parameterName: `${ssmBasePath}/api-id`,
        },
      },
      {
        id: 'FlexPlatformApiRootIdParam',
        props: {
          stringValue: api.restApiRootResourceId,
          description: 'The Root Resource ID of the Flex API Gateway',
          parameterName: `${ssmBasePath}/api-root-id`,
        },
      },
    ].forEach(({ id, props }) => new ssm.StringParameter(this, id, props));

    new cdk.CfnOutput(this, 'FlexPlatformApiUrl', {
      value: api.url,
      description: 'The base URL of the Flex Platform API',
      exportName: `${environment}-flex-platform-api-url`,
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
}
