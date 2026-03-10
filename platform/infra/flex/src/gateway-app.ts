import { getStackName } from "@platform/gov-uk-once";
import * as cdk from "aws-cdk-lib";

import { FlexPrivateGatewayStack } from "./stacks/private-gateway";

const app = new cdk.App();
new FlexPrivateGatewayStack(app, getStackName("FlexPrivateGateway"));
