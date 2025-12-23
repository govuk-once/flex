import type { Construct } from 'constructs';
import { type IAspect, Tags } from 'aws-cdk-lib';
import {
  type CorsOptions,
  type StageOptions,
  Cors,
  MethodLoggingLevel,
} from 'aws-cdk-lib/aws-apigateway';
import {
  type FlexEnvironmentConfig,
  type ResourceTags,
  FlexEnvironment,
  FlexStage,
  ResourceTagsSchema,
} from '@flex/utils';

export const DEFAULT_CORS_OPTIONS: CorsOptions = {
  allowOrigins: Cors.ALL_ORIGINS,
  allowMethods: Cors.ALL_METHODS,
  allowHeaders: Cors.DEFAULT_HEADERS,
};

export function createDeployOptions(stage: FlexStage = 'dev'): StageOptions {
  return {
    stageName: stage,
    tracingEnabled: true,
    metricsEnabled: true,
    loggingLevel: MethodLoggingLevel.INFO,
  };
}

// TODO: Decide what we want to include here
export function getFlexEnvironmentConfig(): FlexEnvironmentConfig {
  const { FLEX_ENV_TAG, FLEX_STAGE, FLEX_STACK } = FlexEnvironment.parse(
    process.env,
  );

  return {
    envTag: FLEX_ENV_TAG,
    stage: FLEX_STAGE,
    stack: FLEX_STACK,
  };
}

export class ResourceTaggingAspect implements IAspect {
  constructor(private readonly tags: ResourceTags) {
    this.tags = ResourceTagsSchema.parse(tags);
  }

  public visit(node: Construct) {
    Object.entries(this.tags).forEach(([k, v]) => Tags.of(node).add(k, v));
  }
}
