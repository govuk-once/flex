import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { Construct } from 'constructs';

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Lambda function
    const helloLambda = new lambda.Function(this, 'HelloLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../dist/lambda'),
      ),
      environment: {
        NODE_ENV: 'production',
      },
      timeout: cdk.Duration.seconds(30),
    });

    // hello lambda 2
    const helloLambda2 = new lambda.Function(this, 'HelloLambda2', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'hello2/handler.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../dist/lambda'),
      ),
      environment: {
        NODE_ENV: 'production',
      },
      timeout: cdk.Duration.seconds(30),
    });

    // Create API Gateway REST API
    const api = new apigateway.RestApi(this, 'FlexApi', {
      restApiName: 'Flex API',
      description: 'Flex API Gateway for Lambda functions',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
    });

    // Create Lambda integration
    const helloIntegration = new apigateway.LambdaIntegration(helloLambda, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    // Add routes
    api.root.addMethod('GET', helloIntegration);
    api.root.addMethod('POST', helloIntegration);

    // Add /hello route
    const helloResource = api.root.addResource('hello');
    helloResource.addMethod('GET', helloIntegration);
    helloResource.addMethod('POST', helloIntegration);

    // Output the API Gateway URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway endpoint URL',
    });

    new cdk.CfnOutput(this, 'HelloLambdaArn', {
      value: helloLambda.functionArn,
      description: 'Hello Lambda function ARN',
    });
  }
}

