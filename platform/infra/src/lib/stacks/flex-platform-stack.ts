import type { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import {
  createSsmParameters,
  CORS_OPTIONS_DEFAULTS,
  DEPLOY_OPTIONS_DEFAULTS,
  FLEX_CONFIG,
} from '@flex/utils';

export interface FlexPlatformStackProps extends cdk.StackProps {
  readonly stage: string;
}

export class FlexPlatformStack extends cdk.Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: FlexPlatformStackProps) {
    super(scope, id, props);

    const { stage } = props;

    const ssmNamespace = FLEX_CONFIG.platform.getSsmNamespace(stage);

    const { API_ID, API_ROOT_ID, API_STAGE, API_URL } = FLEX_CONFIG.platform.ssm;

    const api = new apigw.RestApi(this, 'Api', {
      restApiName: 'Flex API',
      description: 'Central API Gateway for the Flex platform',
      defaultCorsPreflightOptions: CORS_OPTIONS_DEFAULTS,
      deployOptions: {
        ...DEPLOY_OPTIONS_DEFAULTS,
        stageName: stage,
      },
      endpointTypes: [apigw.EndpointType.REGIONAL],
    });

    this.apiUrl = api.url;
    this.addHealthEndpoint(api);

    createSsmParameters(this, [
      {
        id: 'ApiIdParam',
        key: `${ssmNamespace}/${API_ID}`,
        value: api.restApiId,
        description: 'Flex Platform API Gateway REST API ID',
      },
      {
        id: 'ApiRootIdParam',
        key: `${ssmNamespace}/${API_ROOT_ID}`,
        value: api.restApiRootResourceId,
        description: 'Flex Platform API Gateway root resource ID',
      },
      {
        id: 'ApiUrlParam',
        key: `${ssmNamespace}/${API_URL}`,
        value: api.url,
        description: 'Flex Platform API Gateway base URL',
      },
      {
        id: 'ApiStageParam',
        key: `${ssmNamespace}/${API_STAGE}`,
        value: api.deploymentStage.stageName,
        description: 'Flex Platform API Gateway deployment stage',
      },
    ]);

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'Flex API Gateway base URL',
      exportName: `${this.stackName}-api-url`,
    });

    new cdk.CfnOutput(this, 'ApiHealthEndpoint', {
      value: `${api.url}health`,
      description: 'Flex API Gateway health check endpoint',
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
