import type { LogGroupProps } from 'aws-cdk-lib/aws-logs';
import type { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';

// ----------------------------------------------------------------------------
// COMMON
// ----------------------------------------------------------------------------

export type Autocomplete<T extends string> = T | (string & {});

// ----------------------------------------------------------------------------
// ENVIRONMENT
// ----------------------------------------------------------------------------

export type Stage = Autocomplete<'dev'>;

export interface EnvironmentConfig {
  readonly stage: Stage;
  readonly environment: EnvironmentTag;
}

// ----------------------------------------------------------------------------
// TAGS
// ----------------------------------------------------------------------------

export type EnvironmentTag =
  | 'development'
  | 'integration'
  | 'staging'
  | 'production';

export type ExposureTag = 'internal' | 'external';

// https://gds-way.digital.cabinet-office.gov.uk/manuals/aws-tagging.html
export interface ResourceTagOptions {
  /**
   * The name of the product or service
   *
   * @default 'GOV.UK'
   */
  readonly Product: string;
  /**
   * The name of the software system (Avoid abbreviations)
   *
   * @example 'Authentication'
   */
  readonly System: string;
  /**
   * DESCRIPTION
   *
   * @default 'GOV.UK'
   */
  readonly Environment: EnvironmentTag;
  /**
   * An email address for an owner for the resource. For dev environments, this will be an individual email address; elsewhere it will be a group address
   *
   * @example 'owner@digital.cabinet-office.gov.uk'
   */
  readonly Owner: string;
  /**
   * Used to describe the function of a particular resource
   *
   * @example 'account management'
   */
  readonly Service?: string;
  /**
   * List of comma separated URLs that describe the source of the resource
   *
   * @example 'https://www.gov.uk, https://www.digital.cabinet-office.gov.uk'
   */
  readonly Source?: string;
  /**
   * Should specify the level of exposure the resource has to determine its attack surface area
   *
   * @example 'internal'
   */
  readonly Exposure?: ExposureTag;
  /**
   * Should specify the highest data classification level the resource handles. This will help internal security teams to know what level of controls to apply and help focus on the resources with greatest level of risk
   */
  readonly 'Data Classification'?: string;
  /**
   * Helps the organisation's accounting or financial management system to track and allocate expenses or costs to specific departments, teams, projects, or functions
   *
   * @example '12345678'
   */
  readonly 'Cost Centre'?: string;
}

// ----------------------------------------------------------------------------
// LAMBDA
// ----------------------------------------------------------------------------

export interface LambdaFunctionProps {
  /**
   * API Gateway route configuration
   */
  readonly apiRoute: {
    readonly method: Autocomplete<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'>;
    readonly path: string;
  };
  /**
   * Lambda function configuration
   */
  readonly function: Pick<
    NodejsFunctionProps,
    | 'handler'
    | 'runtime'
    | 'functionName'
    | 'description'
    | 'timeout'
    | 'memorySize'
    | 'ephemeralStorageSize'
    | 'architecture'
    | 'reservedConcurrentExecutions'
    | 'environment'
    | 'environmentEncryption'
    | 'runtimeManagementMode'
    | 'tenancyConfig'
    | 'durableConfig'
    | 'snapStart'
  > & {
    readonly entry: string;
  };
  readonly bundler?: Pick<
    NodejsFunctionProps,
    'bundling' | 'depsLockFilePath' | 'projectRoot'
  >;
  readonly logGroup?: LogGroupProps;
  readonly network?: Pick<
    NodejsFunctionProps,
    | 'vpc'
    | 'vpcSubnets'
    | 'securityGroups'
    | 'allowPublicSubnet'
    | 'ipv6AllowedForDualStack'
    | 'allowAllOutbound'
    | 'allowAllIpv6Outbound'
  >;
  readonly iam?: Pick<
    NodejsFunctionProps,
    'role' | 'initialPolicy' | 'codeSigningConfig'
  >;
  readonly eventSources?: Pick<NodejsFunctionProps, 'events'>;
  readonly async?: Pick<
    NodejsFunctionProps,
    'onFailure' | 'onSuccess' | 'maxEventAge' | 'retryAttempts'
  >;
  /**
   * Observability configuration for both tracing and logging
   */
  readonly observability?: Pick<
    NodejsFunctionProps,
    | 'tracing'
    | 'insightsVersion'
    | 'profiling'
    | 'profilingGroup'
    | 'adotInstrumentation'
    | 'paramsAndSecrets'
    | 'loggingFormat'
    | 'applicationLogLevelV2'
    | 'systemLogLevelV2'
    | 'recursiveLoop'
  >;
  readonly storage?: Pick<NodejsFunctionProps, 'filesystem' | 'layers'>;
  readonly dlq?: Pick<
    NodejsFunctionProps,
    'deadLetterQueueEnabled' | 'deadLetterQueue' | 'deadLetterTopic'
  >;
  readonly versioning?: Pick<NodejsFunctionProps, 'currentVersionOptions'>;
}
