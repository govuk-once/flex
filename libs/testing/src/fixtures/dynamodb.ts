import type {
  DeleteCommandInput,
  GetCommandInput,
  PutCommandInput,
  QueryCommandInput,
  ScanCommandInput,
  ScanCommandOutput,
  UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import type { DocumentClientMock } from "./document-client";
import { documentClientMock } from "./document-client";

export type DynamoDBItem = NonNullable<ScanCommandOutput["Items"]>[number];
export type DynamoDBPage = DynamoDBItem[];

const pageCursor = (page: number): DynamoDBItem => ({ testPageCursor: page });

interface DynamoDBCommandFixture<Input> {
  rejects: (error?: Error | string) => void;
  calls: () => Input[];
  input: (index?: number) => Input | undefined;
}

function buildCommandFixture<Input>(
  calls: () => Input[],
  rejects: (error?: Error | string) => void,
): DynamoDBCommandFixture<Input> {
  return { rejects, calls, input: (index = 0) => calls()[index] };
}

interface DynamoDBPagedFixture<Input> extends DynamoDBCommandFixture<Input> {
  resolves: (...pages: DynamoDBPage[]) => void;
  cursor: (page?: number) => DynamoDBItem;
}

export type DynamoDBScanFixture = DynamoDBPagedFixture<ScanCommandInput>;

export type DynamoDBQueryFixture = DynamoDBPagedFixture<QueryCommandInput>;

export interface DynamoDBGetFixture extends DynamoDBCommandFixture<GetCommandInput> {
  resolves: (item?: DynamoDBItem) => void;
}

export interface DynamoDBPutFixture extends DynamoDBCommandFixture<PutCommandInput> {
  resolves: () => void;
}

export interface DynamoDBUpdateFixture extends DynamoDBCommandFixture<UpdateCommandInput> {
  resolves: (attributes?: DynamoDBItem) => void;
}

export interface DynamoDBDeleteFixture extends DynamoDBCommandFixture<DeleteCommandInput> {
  resolves: () => void;
}

export interface DynamoDBFixture {
  client: () => DocumentClientMock;
  scan: DynamoDBScanFixture;
  query: DynamoDBQueryFixture;
  get: DynamoDBGetFixture;
  put: DynamoDBPutFixture;
  update: DynamoDBUpdateFixture;
  delete: DynamoDBDeleteFixture;
}

function buildPagedStub(
  command: typeof ScanCommand | typeof QueryCommand,
  pages: DynamoDBPage[],
): void {
  let stub = documentClientMock().on(command);

  pages.slice(0, -1).forEach((items, page) => {
    stub = stub.resolvesOnce({
      Items: items,
      LastEvaluatedKey: pageCursor(page),
    });
  });

  stub.resolves({ Items: pages.at(-1) ?? [] });
}

export function createDynamoDBFixture(): DynamoDBFixture {
  return {
    client: documentClientMock,
    scan: {
      ...buildCommandFixture(
        () =>
          documentClientMock()
            .commandCalls(ScanCommand)
            .map(({ args }) => args[0].input),
        (error) => documentClientMock().on(ScanCommand).rejects(error),
      ),
      resolves: (...pages) => {
        buildPagedStub(ScanCommand, pages);
      },
      cursor: (page = 0) => pageCursor(page),
    },

    query: {
      ...buildCommandFixture(
        () =>
          documentClientMock()
            .commandCalls(QueryCommand)
            .map(({ args }) => args[0].input),
        (error) => documentClientMock().on(QueryCommand).rejects(error),
      ),
      resolves: (...pages) => {
        buildPagedStub(QueryCommand, pages);
      },
      cursor: (page = 0) => pageCursor(page),
    },

    get: {
      ...buildCommandFixture(
        () =>
          documentClientMock()
            .commandCalls(GetCommand)
            .map(({ args }) => args[0].input),
        (error) => documentClientMock().on(GetCommand).rejects(error),
      ),
      resolves: (item) =>
        documentClientMock()
          .on(GetCommand)
          .resolves(item ? { Item: item } : {}),
    },

    put: {
      ...buildCommandFixture(
        () =>
          documentClientMock()
            .commandCalls(PutCommand)
            .map(({ args }) => args[0].input),
        (error) => documentClientMock().on(PutCommand).rejects(error),
      ),
      resolves: () => documentClientMock().on(PutCommand).resolves({}),
    },

    update: {
      ...buildCommandFixture(
        () =>
          documentClientMock()
            .commandCalls(UpdateCommand)
            .map(({ args }) => args[0].input),
        (error) => documentClientMock().on(UpdateCommand).rejects(error),
      ),
      resolves: (attributes) =>
        documentClientMock()
          .on(UpdateCommand)
          .resolves(attributes ? { Attributes: attributes } : {}),
    },

    delete: {
      ...buildCommandFixture(
        () =>
          documentClientMock()
            .commandCalls(DeleteCommand)
            .map(({ args }) => args[0].input),
        (error) => documentClientMock().on(DeleteCommand).rejects(error),
      ),
      resolves: () => {
        documentClientMock().on(DeleteCommand).resolves({});
      },
    },
  };
}
