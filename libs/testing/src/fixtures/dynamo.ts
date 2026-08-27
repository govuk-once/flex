import type {
  QueryCommandInput,
  ScanCommandInput,
  ScanCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type { AwsClientStub } from "aws-sdk-client-mock";
import { mockClient } from "aws-sdk-client-mock";

import { useClientMock } from "../utils/awsMock";

export type DynamoItem = NonNullable<ScanCommandOutput["Items"]>[number];

/** One page of a Scan, as the table would return it. */
export type DynamoScanPage = DynamoItem[];

/** One page of a Query, as the index would return it. */
export type DynamoQueryPage = DynamoItem[];

type DynamoMock = AwsClientStub<DynamoDBDocumentClient>;

const createDynamoMock = (): DynamoMock => mockClient(DynamoDBDocumentClient);

const dynamoMock = () => useClientMock(createDynamoMock);

/**
 * Key returned at the end of the given page. DynamoDB echoes this back as the
 * next command's `ExclusiveStartKey`, so the shape only has to be identifiable.
 */
const pageCursor = (page: number): DynamoItem => ({ testPageCursor: page });

export interface DynamoScanFixture {
  /**
   * Stubs the table read. Each argument is one page; a handler only reaches
   * the pages after the first if it follows `LastEvaluatedKey`.
   */
  resolves: (...pages: DynamoScanPage[]) => void;
  /** Fails the read, as an unreachable table or a denied role does. */
  rejects: (error?: Error | string) => void;
  /** Every Scan the handler sent, in order. */
  calls: () => ScanCommandInput[];
  /** The nth Scan the handler sent, defaulting to the first. */
  input: (index?: number) => ScanCommandInput | undefined;
  /** The key `resolves` hands back at the end of the given page. */
  cursor: (page?: number) => DynamoItem;
}

export interface DynamoQueryFixture {
  /**
   * Stubs the index query. Each argument is one page; a handler only reaches
   * the pages after the first if it follows `LastEvaluatedKey`.
   */
  resolves: (...pages: DynamoQueryPage[]) => void;
  /** Fails the query, as an unreachable table or a denied role does. */
  rejects: (error?: Error | string) => void;
  /** Every Query the handler sent, in order. */
  calls: () => QueryCommandInput[];
  /** The nth Query the handler sent, defaulting to the first. */
  input: (index?: number) => QueryCommandInput | undefined;
  /** The key `resolves` hands back at the end of the given page. */
  cursor: (page?: number) => DynamoItem;
}

export interface DynamoFixture {
  scan: DynamoScanFixture;
  query: DynamoQueryFixture;
  /** The underlying client mock, for commands the helpers do not cover. */
  client: () => DynamoMock;
}

function buildPagedStub(
  command: typeof ScanCommand | typeof QueryCommand,
  pages: DynamoScanPage[] | DynamoQueryPage[],
): void {
  let stub = dynamoMock().on(command);

  pages.slice(0, -1).forEach((items, page) => {
    stub = stub.resolvesOnce({
      Items: items,
      LastEvaluatedKey: pageCursor(page),
    });
  });

  // The last page carries no cursor, which is what ends the read.
  stub.resolves({ Items: pages.at(-1) ?? [] });
}

export function createDynamoFixture(): DynamoFixture {
  const scanCalls = () =>
    dynamoMock()
      .commandCalls(ScanCommand)
      .map(({ args }) => args[0].input);

  const queryCalls = () =>
    dynamoMock()
      .commandCalls(QueryCommand)
      .map(({ args }) => args[0].input);

  const scan: DynamoScanFixture = {
    resolves: (...pages) => {
      buildPagedStub(ScanCommand, pages);
    },
    rejects: (error) => {
      dynamoMock().on(ScanCommand).rejects(error);
    },
    calls: scanCalls,
    input: (index = 0) => scanCalls()[index],
    cursor: (page = 0) => pageCursor(page),
  };

  const query: DynamoQueryFixture = {
    resolves: (...pages) => {
      buildPagedStub(QueryCommand, pages);
    },
    rejects: (error) => {
      dynamoMock().on(QueryCommand).rejects(error);
    },
    calls: queryCalls,
    input: (index = 0) => queryCalls()[index],
    cursor: (page = 0) => pageCursor(page),
  };

  return { scan, query, client: dynamoMock };
}
