import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import {
  type LambdaFunctionProps,
  FLEX_CONFIG,
  getSsmParameter,
  LAMBDA_FUNCTION_DEFAULTS,
  LAMBDA_LOG_GROUP_DEFAULTS,
  LAMBDA_OBSERVABILITY_DEFAULTS,
} from '@flex/utils';

export interface FlexFunctionProps extends LambdaFunctionProps {
  readonly stage: string;
}

export class FlexFunction extends Construct {
  public readonly lambdaFn: lambdaNodejs.NodejsFunction;
  public readonly apiResource: apigw.IResource;
  public readonly logGroup: logs.LogGroup;
  public readonly endpointUrl: string;
  public readonly httpMethod: string;
  public readonly resourcePath: string;

  constructor(scope: Construct, id: string, props: FlexFunctionProps) {
    super(scope, id);

    const {
      stage,
      apiRoute,
      function: lambdaFnConfig,
      bundler,
      logGroup: logGroupConfig,
      network,
      iam: iamConfig,
      eventSources,
      async,
      observability,
      storage,
      dlq,
      versioning,
    } = props;

    const ssmNamespace = FLEX_CONFIG.platform.getSsmNamespace(stage);

    const { API_ID, API_ROOT_ID, API_URL, API_STAGE } = FLEX_CONFIG.platform.ssm;

    const stack = cdk.Stack.of(this);

    this.httpMethod = apiRoute.method.toUpperCase();
    this.resourcePath = apiRoute.path.trim().replace(/^\/+/, '');

    this.logGroup = new logs.LogGroup(this, 'LogGroup', {
      ...LAMBDA_LOG_GROUP_DEFAULTS,
      ...logGroupConfig,
    });

    this.lambdaFn = new lambdaNodejs.NodejsFunction(this, 'Lambda', {
      ...LAMBDA_FUNCTION_DEFAULTS,
      ...LAMBDA_OBSERVABILITY_DEFAULTS,
      ...lambdaFnConfig,
      ...bundler,
      ...network,
      ...iamConfig,
      ...eventSources,
      ...async,
      ...observability,
      ...storage,
      ...dlq,
      ...versioning,
      logGroup: this.logGroup,
    });

    const apiId = getSsmParameter(this, `${ssmNamespace}/${API_ID}`);
    const apiRootId = getSsmParameter(this, `${ssmNamespace}/${API_ROOT_ID}`);
    const apiUrl = getSsmParameter(this, `${ssmNamespace}/${API_URL}`);
    const apiStage = getSsmParameter(this, `${ssmNamespace}/${API_STAGE}`);

    const api = apigw.RestApi.fromRestApiAttributes(this, 'Api', {
      restApiId: apiId,
      rootResourceId: apiRootId,
    });

    this.endpointUrl = `${apiUrl}${this.resourcePath}`;
    this.apiResource = api.root.resourceForPath(this.resourcePath);

    this.lambdaFn.addPermission('ApiGatewayInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: api.arnForExecuteApi(
        this.httpMethod,
        `/${this.resourcePath}`,
        apiStage,
      ),
    });

    this.lambdaFn.addPermission('ApiGatewayInvokeTest', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: api.arnForExecuteApi(
        this.httpMethod,
        `/${this.resourcePath}`,
        'test-invoke-stage',
      ),
    });

    this.apiResource.addMethod(
      this.httpMethod,
      new apigw.Integration({
        type: apigw.IntegrationType.AWS_PROXY,
        integrationHttpMethod: 'POST',
        uri: `arn:${cdk.Aws.PARTITION}:apigateway:${stack.region}:lambda:path/2015-03-31/functions/${this.lambdaFn.functionArn}/invocations`,
      }),
    );

    const routeHash = `${this.httpMethod}-${this.resourcePath}`;

    const trigger = new cr.AwsCustomResource(this, 'DeploymentTrigger', {
      onCreate: {
        service: 'APIGateway',
        action: 'createDeployment',
        parameters: {
          restApiId: apiId,
          stageName: apiStage,
          description: `Deployed by ${stack.stackName}`,
        },
        physicalResourceId: cr.PhysicalResourceId.of(
          `deployment-${stack.stackName}-${routeHash}`,
        ),
      },
      onUpdate: {
        service: 'APIGateway',
        action: 'createDeployment',
        parameters: {
          restApiId: apiId,
          stageName: apiStage,
          description: `Updated by ${stack.stackName}`,
        },
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['apigateway:POST'],
          resources: [
            `arn:${cdk.Aws.PARTITION}:apigateway:${stack.region}::/restapis/${apiId}/deployments`,
          ],
        }),
      ]),
      installLatestAwsSdk: false,
    });

    trigger.node.addDependency(this.apiResource);
  }
}
