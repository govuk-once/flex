import { IFunction } from "aws-cdk-lib/aws-lambda";

export interface PublicRouteBinding {
  path: string;
  method: string;
  handler: IFunction;
}
