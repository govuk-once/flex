import { getEnvConfig } from "@flex/utils";
import { Duration, Tags } from "aws-cdk-lib";
import { ISecurityGroup, IVpc, SubnetType } from "aws-cdk-lib/aws-ec2";
import { Function, Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

import {
  resolveEncryptionKey,
  resolveSignedLambdaConfig,
} from "../../utils/lambda";
import { toKebabCase } from "../../utils/routes";
import { LambdaAlarms } from "../alarms/lambda";
import { FlexFunctionProps } from "../types";

const { stage } = getEnvConfig();

interface FlexPrivateEgressFunctionProps extends FlexFunctionProps {
  vpc: IVpc;
  privateEgressSg: ISecurityGroup;
  enableDefaultAlarms?: boolean;
}

export class FlexPrivateEgressFunction extends Construct {
  public readonly function: Function;

  constructor(
    scope: Construct,
    id: string,
    {
      vpc,
      privateEgressSg,
      criticalAction,
      warningAction,
      enableDefaultAlarms = true,
      entry: _entry,
      domain,
      ...functionProps
    }: FlexPrivateEgressFunctionProps,
  ) {
    super(scope, id);

    const logGroup = new LogGroup(this, "LogGroup", {
      retention: RetentionDays.ONE_YEAR,
    });

    const encryptionKey = resolveEncryptionKey(this);
    const { code, codeSigningConfig } = resolveSignedLambdaConfig(this, id);

    this.function = new Function(this, "Function", {
      runtime: Runtime.NODEJS_24_X,
      handler: "index.handler",
      tracing: Tracing.ACTIVE,
      timeout: Duration.seconds(10),
      ...functionProps,
      code,
      codeSigningConfig,
      environmentEncryption: encryptionKey,
      environment: {
        ...functionProps.environment,
        FLEX_ENVIRONMENT: stage,
      },
      logGroup,
      securityGroups: [privateEgressSg],
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    encryptionKey.grantDecrypt(this.function);

    if (enableDefaultAlarms) {
      new LambdaAlarms(this, "Alarm", {
        fn: this.function,
        alarmNamePrefix: `${stage}-${toKebabCase(id)}-alarm`,
        criticalAction,
        warningAction,
      });
    }

    if (domain) {
      Tags.of(this.function).add("ResourceOwner", domain, {
        priority: 200,
      });
    }
  }
}
