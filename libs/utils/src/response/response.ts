import type { APIGatewayProxyResult } from 'aws-lambda';

export const generateResponse = ({
  status,
  data,
  headers = {},
}: {
  status: number;
  data: Record<string, unknown> | string;
  headers?: Record<string, string>;
}): APIGatewayProxyResult => {
  if (status === 204) {
    return {
      statusCode: status,
      headers: headers,
      body: '', // Explicitly return an empty body
    };
  }

  const defaultHeaders = { 'Content-Type': 'application/json' };
  const bodyContent = JSON.stringify({ data });

  return {
    statusCode: status,
    headers: { ...defaultHeaders, ...headers },
    body: bodyContent,
  };
};

export const generateErrorResponse = ({
  status,
  data,
}: {
  status: number;
  data: string;
}): APIGatewayProxyResult => {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/x-amz-json-1.1' },
    body: JSON.stringify({ data }),
  };
};
