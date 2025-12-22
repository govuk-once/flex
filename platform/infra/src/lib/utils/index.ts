import type { Construct } from 'constructs';
import { type IAspect, Tags } from 'aws-cdk-lib';
import {
  type CorsOptions,
  type StageOptions,
  Cors,
  MethodLoggingLevel,
} from 'aws-cdk-lib/aws-apigateway';

import type {
  EnvironmentConfig,
  ResourceTagEnvironment,
  ResourceTagOptions,
} from '../types';

export const DEFAULT_CORS_OPTIONS: CorsOptions = {
  allowOrigins: Cors.ALL_ORIGINS,
  allowMethods: Cors.ALL_METHODS,
  allowHeaders: Cors.DEFAULT_HEADERS,
};

export const DEFAULT_DEPLOY_OPTIONS = {
  stageName: 'dev',
  tracingEnabled: true,
  metricsEnabled: true,
  loggingLevel: MethodLoggingLevel.INFO,
} as const satisfies StageOptions;

// TODO: Decide what we want to include here
export function getEnvironmentConfig(): EnvironmentConfig {
  const environment = process.env.DEV_ENV || 'dev';
  const environmentTag =
    (process.env.ENV_TAG as ResourceTagEnvironment) || 'development';
  const stackName = process.env.DEV_STACK_NAME || environment;

  return {
    environment,
    environmentTag,
    stackName,
  };
}

export class ResourceTaggingAspect implements IAspect {
  constructor(private readonly tags: ResourceTagOptions) {}

  public visit(node: Construct) {
    Object.entries(this.tags).forEach(([k, v]) => Tags.of(node).add(k, v));
  }
}
