import type { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';

import type {
  EnvironmentConfig,
  EnvironmentTag,
  ResourceTagOptions,
} from '../types';

// ----------------------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------------------

export const FLEX_CONFIG = {
  getSsmNamespace: (stage: string) => `/${stage}/flex`,
  getCfnExportNamespace: (stage: string) => `${stage}-flex`,
  platform: {
    getSsmNamespace: (stage: string) => `/${stage}/flex/platform`,
    ssm: {
      API_ID: 'api-id',
      API_ROOT_ID: 'api-root-id',
      API_URL: 'api-url',
      API_STAGE: 'api-stage',
    },
  },
} as const;

// ----------------------------------------------------------------------------
// ENVIRONMENT
// ----------------------------------------------------------------------------

export const getEnvironmentConfig = (): EnvironmentConfig => {
  return {
    stage: process.env.STAGE || 'dev',
    environment: (process.env.ENVIRONMENT as EnvironmentTag) || 'development',
  };
};

// ----------------------------------------------------------------------------
// API GATEWAY
// ----------------------------------------------------------------------------

export const CORS_OPTIONS_DEFAULTS: apigw.CorsOptions = {
  allowOrigins: apigw.Cors.ALL_ORIGINS,
  allowMethods: apigw.Cors.ALL_METHODS,
  allowHeaders: apigw.Cors.DEFAULT_HEADERS,
};

export const DEPLOY_OPTIONS_DEFAULTS: apigw.StageOptions = {
  stageName: 'dev',
  tracingEnabled: true,
  metricsEnabled: true,
  loggingLevel: apigw.MethodLoggingLevel.INFO,
};

// ----------------------------------------------------------------------------
// LAMBDA
// ----------------------------------------------------------------------------

export const LAMBDA_FUNCTION_DEFAULTS: lambdaNodejs.NodejsFunctionProps = {
  handler: 'handler',
  runtime: lambda.Runtime.NODEJS_22_X,
  memorySize: 128,
};

export const LAMBDA_OBSERVABILITY_DEFAULTS = {
  tracing: lambda.Tracing.ACTIVE,
};

export const LAMBDA_LOG_GROUP_DEFAULTS: logs.LogGroupProps = {
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  retention: logs.RetentionDays.ONE_MONTH,
};

// ----------------------------------------------------------------------------
// SSM
// ----------------------------------------------------------------------------

export const createSsmParameters = (
  scope: Construct,
  parameters: {
    readonly id: string;
    readonly key: string; // e.g. /dev/flex/api-id
    readonly value: string;
    readonly description: string;
  }[],
) => {
  return parameters.map(
    ({ id, key, value, description }) =>
      new ssm.StringParameter(scope, id, {
        parameterName: key,
        stringValue: value,
        description,
      }),
  );
};

export const getSsmParameter = (
  scope: Construct,
  key: string, // e.g. /dev/flex/api-id
) => {
  return ssm.StringParameter.valueForStringParameter(scope, key);
};

// ----------------------------------------------------------------------------
// TAGS
// ----------------------------------------------------------------------------

export class ResourceTaggingAspect implements cdk.IAspect {
  constructor(private readonly tags: ResourceTagOptions) {}

  public visit(node: Construct) {
    Object.entries(this.tags).forEach(([k, v]) => cdk.Tags.of(node).add(k, v));
  }
}
