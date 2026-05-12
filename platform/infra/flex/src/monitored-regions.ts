import type { BaseStackProps } from "./base/types";

type SupportedRegion = BaseStackProps["env"]["region"];

export interface MonitoredRegion {
  region: SupportedRegion;
}

export const MONITORED_REGIONS: readonly MonitoredRegion[] = [
  { region: "eu-west-2" },
  { region: "us-east-1" },
] as const;
