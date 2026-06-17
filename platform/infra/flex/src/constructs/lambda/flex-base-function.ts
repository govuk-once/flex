import { getEnvConfig } from "@flex/utils";
import { Tags } from "aws-cdk-lib";
import { type IKey, Key } from "aws-cdk-lib/aws-kms";
import { Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import {
  NodejsFunction,
  type NodejsFunctionProps,
} from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

import { ENV_KEYS } from "../../ssm-keys";
import { LambdaAlarms } from "../alarms/lambda";
import type { FlexFunctionProps } from "../types";

const { stage } = getEnvConfig();

function resolveKey(scope: Construct): IKey {
  const encryptionKeyArn = StringParameter.valueForStringParameter(
    scope,
    ENV_KEYS.FlexEncryptionKey,
  );
  return Key.fromKeyArn(scope, "FlexEncryptionKey", encryptionKeyArn);
}

export abstract class FlexBaseFunction extends Construct {
  public readonly function: NodejsFunction;

  constructor(
    scope: Construct,
    id: string,
    props: FlexFunctionProps,
    extraNodejsProps?: Partial<NodejsFunctionProps>,
  ) {
    super(scope, id);

    const { criticalAction, warningAction, domain, ...nodejsProps } = props;

    const logGroup = new LogGroup(this, "LogGroup", {
      retention: RetentionDays.ONE_YEAR,
    });

    this.function = new NodejsFunction(this, "Function", {
      runtime: Runtime.NODEJS_24_X,
      tracing: Tracing.ACTIVE,
      ...nodejsProps,
      environmentEncryption: resolveKey(this),
      environment: {
        ...nodejsProps.environment,
        FLEX_ENVIRONMENT: stage,
      },
      logGroup,
      ...extraNodejsProps,
    });

    new LambdaAlarms(this, "Alarm", {
      fn: this.function,
      alarmNamePrefix: `${stage}-${id.toLowerCase()}-alarm`,
      criticalAction,
      warningAction,
    });

    if (domain) {
      Tags.of(this.function).add("ResourceOwner", domain, {
        priority: 200,
      });
    }
  }
}
