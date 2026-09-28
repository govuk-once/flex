import { DynamoDBClient as AwsDynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getAssumedRoleCredentials } from "@flex/sdk";
import { assertNever } from "@flex/utils";
import type { z } from "zod";

import type {
  DynamoDBAuth,
  DynamoDBClient,
  DynamoDBClientOptions,
  DynamoDBItemSchema,
} from "../../../types";
import { createExecute } from "./execute";
import {
  createInputParser,
  createItemParser,
  createItemsParser,
} from "./items";
import {
  createDelete,
  createGet,
  createPut,
  createQuery,
  createScan,
  createUpdate,
} from "./operations";
import type { OperationContext } from "./operations/context";

interface BuildDocumentClientOptions {
  readonly auth: DynamoDBAuth;
  readonly region: string;
}

function buildDocumentClient({
  auth,
  region,
}: BuildDocumentClientOptions): DynamoDBDocumentClient {
  switch (auth.type) {
    case "default":
      return DynamoDBDocumentClient.from(new AwsDynamoDBClient({ region }));
    case "role": {
      const { roleArn, roleName, externalId } = auth;

      return DynamoDBDocumentClient.from(
        new AwsDynamoDBClient({
          region,
          credentials: getAssumedRoleCredentials({
            region,
            roleArn,
            roleName,
            externalId,
          }),
        }),
      );
    }
    default:
      return assertNever(auth);
  }
}

export function createDynamoDBClient<Schema extends DynamoDBItemSchema>({
  table,
  region,
  auth,
  schema,
}: DynamoDBClientOptions<Schema>): DynamoDBClient<
  z.output<Schema>,
  z.input<Schema>
> {
  const context: OperationContext<z.output<Schema>, z.input<Schema>> = {
    table,
    client: buildDocumentClient({ auth, region }),
    execute: createExecute(table),
    parseItem: createItemParser(schema),
    parseItems: createItemsParser(schema),
    parseInput: createInputParser(schema),
  };

  return {
    scan: createScan(context),
    query: createQuery(context),
    get: createGet(context),
    put: createPut(context),
    update: createUpdate(context),
    delete: createDelete(context),
  };
}
