import type {
  ScanCommandInput,
  ScanCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { AwsClientStub } from "aws-sdk-client-mock";
import { mockClient } from "aws-sdk-client-mock";

import { useClientMock } from "../utils/awsMock";

export type DynamoItem = NonNullable<ScanCommandOutput["Items"]>[number];

/** One page of a Scan, as the table would return it. */
export type DynamoScanPage = DynamoItem[];

type DynamoMock = AwsClientStub<DynamoDBDocumentClient>;

const createDynamoMock = (): DynamoMock => mockClient(DynamoDBDocumentClient);

const dynamoMock = () => useClientMock(createDynamoMock);

/**
 * Key returned at the end of the given page. DynamoDB echoes this back as the
 * next Scan's `ExclusiveStartKey`, so the shape only has to be identifiable.
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

export interface DynamoFixture {
  scan: DynamoScanFixture;
  /** The underlying client mock, for commands the helpers do not cover. */
  client: () => DynamoMock;
}

export function createDynamoFixture(): DynamoFixture {
  const calls = () =>
    dynamoMock()
      .commandCalls(ScanCommand)
      .map(({ args }) => args[0].input);

  const scan: DynamoScanFixture = {
    resolves: (...pages) => {
      let stub = dynamoMock().on(ScanCommand);

      pages.slice(0, -1).forEach((items, page) => {
        stub = stub.resolvesOnce({
          Items: items,
          LastEvaluatedKey: pageCursor(page),
        });
      });

      // The last page carries no cursor, which is what ends the read. Stubbing
      // it with `resolves` also keeps any further Scan from returning
      // `undefined`, which would surface as an unrelated TypeError.
      stub.resolves({ Items: pages.at(-1) ?? [] });
    },
    rejects: (error) => {
      dynamoMock().on(ScanCommand).rejects(error);
    },
    calls,
    input: (index = 0) => calls()[index],
    cursor: (page = 0) => pageCursor(page),
  };

  return { scan, client: dynamoMock };
}
