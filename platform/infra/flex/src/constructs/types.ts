import type { FunctionProps } from "aws-cdk-lib/aws-lambda";

import type { AlarmActionProps } from "./alarms/types";

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type FlexFunctionProps = Omit<
  PartialBy<FunctionProps, "code" | "handler" | "runtime">,
  "logGroup"
> & {
  readonly entry: string;
  readonly domain?: string;
} & AlarmActionProps;
