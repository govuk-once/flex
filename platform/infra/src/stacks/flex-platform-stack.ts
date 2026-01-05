import type { Construct } from 'constructs';
import { AccessLogFormat } from 'aws-cdk-lib/aws-apigateway';
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod,
  HttpStage,
  LogGroupLogDestination,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';

import { GovUkOnceStack } from './gov-uk-once-stack';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';

export class FlexPlatformStack extends GovUkOnceStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      env: {
        region: 'eu-west-2',
      },
      tags: {
        Product: 'GOV.UK',
        System: 'FLEX',
        Owner: '',
        Source: 'https://github.com/govuk-once/flex',
      },
    });

    const accessLogGroup = new LogGroup(this, 'ApiAccessLogs', {
      retention: RetentionDays.ONE_WEEK,
    });

    const httpApi = new HttpApi(this, 'Api', {
      apiName: 'Flex Platform API',
      description: 'Central API Gateway for the Flex Platform',
      corsPreflight: {
        allowOrigins: ['*'],
        allowHeaders: ['Authorization', 'Content-Type'],
        allowMethods: [CorsHttpMethod.ANY],
      },
      createDefaultStage: false,
    });

    const httpApiStage = new HttpStage(this, 'ApiStage', {
      httpApi,
      stageName: '$default',
      autoDeploy: true,
      accessLogSettings: {
        destination: new LogGroupLogDestination(accessLogGroup),
        format: AccessLogFormat.jsonWithStandardFields({
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
          caller: true,
        }),
      },
      detailedMetricsEnabled: true,
    });

    httpApi.addRoutes({
      path: '/hello',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        'HelloIntegration',
        new Function(this, 'HelloLambda', {
          runtime: Runtime.NODEJS_24_X,
          handler: 'index.handler',
          code: Code.fromInline(
            `exports.handler = (event) => ({ statusCode: 200, body: "Hello World" });`,
          ),
        }),
      ),
    });
  }
}
