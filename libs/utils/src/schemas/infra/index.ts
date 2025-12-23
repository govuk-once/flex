import { z } from 'zod';

import { NonEmptyString, Url } from '../common';

// ============================================================================
// RESOURCE TAGGING
// ============================================================================

export const ProductTag = z
  .enum(['GOV.UK', 'GOV.UK One Login', 'DSP'])
  .default('GOV.UK');
export type ProductTag = z.output<typeof ProductTag>;

export const SystemTag = NonEmptyString.meta({
  description: 'The name of the software system (Avoid abbreviations)',
  example: 'Authentication',
});
export type SystemTag = z.output<typeof SystemTag>;

export const EnvironmentTag = z
  .enum(['development', 'integration', 'staging', 'production'])
  .default('development');
export type EnvironmentTag = z.output<typeof EnvironmentTag>;

export const OwnerTag = z.email().meta({
  description:
    'An email address for an owner for the resource. For dev environments, this will be an individual email address; elsewhere it will be a group address',
  example: 'owner@digital.cabinet-office.gov.uk',
});
export type OwnerTag = z.output<typeof OwnerTag>;

export const ServiceTag = NonEmptyString.optional().meta({
  description: 'Used to describe the function of a particular resource',
  example: 'account management',
});
export type ServiceTag = z.output<typeof ServiceTag>;

export const SourceTag = z
  .string()
  .trim()
  .min(1, { message: 'Must include at least one URL' })
  .refine(
    (v) =>
      !v.includes('  ') && v.split(' ').every((p) => Url.safeParse(p).success),
    { message: 'Must include at least one valid URL separated by spaces' },
  )
  .optional();
export type SourceTag = z.output<typeof SourceTag>;

export const ExposureTag = z.enum(['internal', 'external']).optional().meta({
  description:
    'Should specify the level of exposure the resource has to determine its attack surface area',
  example: 'internal',
});
export type ExposureTag = z.output<typeof ExposureTag>;

export const DataClassificationTag = NonEmptyString.optional().meta({
  description:
    'Should specify the highest data classification level the resource handles. This will help internal security teams to know what level of controls to apply and help focus on the resources with greatest level of risk',
});
export type DataClassificationTag = z.output<typeof DataClassificationTag>;

export const CostCentreTag = NonEmptyString.optional().meta({
  description:
    "Helps the organisation's accounting or financial management system to track and allocate expenses or costs to specific departments, teams, projects, or functions",
  example: '12345678',
});
export type CostCentreTag = z.output<typeof CostCentreTag>;

export const ResourceTagsSchema = z.object({
  Product: ProductTag,
  System: SystemTag,
  Environment: EnvironmentTag,
  Owner: OwnerTag,
  Service: ServiceTag,
  Source: SourceTag,
  Exposure: ExposureTag,
  'Data Classification': DataClassificationTag,
  'Cost Centre': CostCentreTag,
});
export type ResourceTags = z.output<typeof ResourceTagsSchema>;

// ============================================================================
// ENVIRONMENT
// ============================================================================

export const ReservedStages = z.enum(['dev', 'staging', 'prod']);
export type ReservedStage = z.output<typeof ReservedStages>;

export const FlexStack = NonEmptyString.default('flex');
export type FlexStack = z.output<typeof FlexStack>;

export const FlexStage = NonEmptyString.default('dev');
export type FlexStage = z.output<typeof FlexStage>;

export const FlexEnvironment = z.object({
  FLEX_ENV_TAG: EnvironmentTag,
  FLEX_STACK: FlexStack,
  FLEX_STAGE: FlexStage,
});
export type FlexEnvironment = z.output<typeof FlexEnvironment>;

export interface FlexEnvironmentConfig {
  readonly envTag: EnvironmentTag;
  readonly stage: FlexStage;
  readonly stack: FlexStack;
}
