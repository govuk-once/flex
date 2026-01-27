import { NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type FlexFunctionProps = Exclude<
  PartialBy<NodejsFunctionProps, "handler" | "runtime">,
  "logGroup"
> & {
  readonly domain?: string;
};
