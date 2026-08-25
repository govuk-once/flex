import type { GetSecretValueCommandInput } from "@aws-sdk/client-secrets-manager";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import type { AwsClientStub } from "aws-sdk-client-mock";
import { mockClient } from "aws-sdk-client-mock";

import { useClientMock } from "../utils/awsMock";

const SECRET_ACCOUNT_ID = "123456789012";
const DEFAULT_REGION = "eu-west-2";

type SecretsMock = AwsClientStub<SecretsManagerClient>;

const createSecretsMock = (): SecretsMock => mockClient(SecretsManagerClient);

const secretsMock = () => useClientMock(createSecretsMock);

/** ARN a secret of this name has in the test account. */
const buildSecretArn = (name: string) =>
  `arn:aws:secretsmanager:${process.env.AWS_REGION ?? DEFAULT_REGION}:${SECRET_ACCOUNT_ID}:secret:${name}`;

export interface SecretFixture {
  /**
   * Stubs the secret and returns its ARN, which is the value a gateway's
   * resource environment variable holds.
   */
  resolves: (name: string, value: unknown) => string;
  /** Fails the read, as a missing secret or a denied policy does. */
  rejects: (name: string, error?: Error | string) => string;
  /** ARN the named secret would have, without stubbing it. */
  arn: (name: string) => string;
  /** Every secret read the handler issued, in order. */
  calls: () => GetSecretValueCommandInput[];
}

export function createSecretFixture(): SecretFixture {
  return {
    resolves: (name, value) => {
      const arn = buildSecretArn(name);

      secretsMock()
        .on(GetSecretValueCommand, { SecretId: arn })
        .resolves({
          ARN: arn,
          Name: name,
          SecretString:
            typeof value === "string" ? value : JSON.stringify(value),
        });

      return arn;
    },
    rejects: (name, error) => {
      const arn = buildSecretArn(name);

      secretsMock().on(GetSecretValueCommand, { SecretId: arn }).rejects(error);

      return arn;
    },
    arn: buildSecretArn,
    calls: () =>
      secretsMock()
        .commandCalls(GetSecretValueCommand)
        .map(({ args }) => args[0].input),
  };
}
