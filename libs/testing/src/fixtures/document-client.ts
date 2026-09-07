import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { AwsClientStub } from "aws-sdk-client-mock";
import { mockClient } from "aws-sdk-client-mock";

import { useClientMock } from "../utils/awsMock";

export type DocumentClientMock = AwsClientStub<DynamoDBDocumentClient>;

const createDocumentClientMock = (): DocumentClientMock =>
  mockClient(DynamoDBDocumentClient);

export const documentClientMock = () => useClientMock(createDocumentClientMock);
