import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createStoreFromSeed, InMemoryUdpStore } from './InMemoryUdpStore';

interface UdpStubHandlerDependencies {
  store: InMemoryUdpStore;
  latencyMs?: number;
}

class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const baseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
  'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

const delay = async (ms?: number): Promise<void> => {
  if (!ms || ms <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
};

const jsonResponse = (
  statusCode: number,
  body?: unknown,
): APIGatewayProxyResult => ({
  statusCode,
  headers: baseHeaders,
  body: body ? JSON.stringify(body) : '',
});

const parseBody = (body?: string | null) => {
  if (!body) {
    throw new HttpError(400, 'Request body is required');
  }

  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'Invalid JSON payload');
  }
};

const parseLatency = (rawLatency?: string): number => {
  if (!rawLatency) {
    return 0;
  }

  const parsed = Number.parseInt(rawLatency, 10);
  return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
};

export const createUdpStubHandler =
  ({ store, latencyMs = 0 }: UdpStubHandlerDependencies) =>
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    await delay(latencyMs);

    if (event.httpMethod === 'OPTIONS') {
      return jsonResponse(204);
    }

    const userId = event.pathParameters?.userId;

    if (!userId) {
      return jsonResponse(400, {
        error: 'Path parameter "userId" is required.',
      });
    }

    try {
      switch (event.httpMethod?.toUpperCase()) {
        case 'GET': {
          const record = store.get(userId);

          if (!record) {
            return jsonResponse(404, { error: 'User topics not found.' });
          }

          return jsonResponse(200, record);
        }

        case 'PUT': {
          const payload = parseBody(event.body);
          const data = payload?.data;

          if (
            typeof data !== 'object' ||
            data === null ||
            Array.isArray(data)
          ) {
            throw new HttpError(
              400,
              'Request payload must contain a "data" object.',
            );
          }

          const record = store.upsert(userId, data as Record<string, unknown>);
          return jsonResponse(200, record);
        }

        case 'DELETE': {
          const deleted = store.delete(userId);

          if (!deleted) {
            return jsonResponse(404, { error: 'User topics not found.' });
          }

          return jsonResponse(204);
        }

        default:
          return jsonResponse(405, {
            error: `Unsupported method ${event.httpMethod}`,
          });
      }
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonResponse(error.statusCode, { error: error.message });
      }

      console.error('UDP stub handler error', error);
      return jsonResponse(500, {
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  };

const defaultStore = createStoreFromSeed(process.env.UDP_STUB_SEED_DATA);
const defaultLatency = parseLatency(process.env.UDP_STUB_LATENCY_MS);

export const handler = createUdpStubHandler({
  store: defaultStore,
  latencyMs: defaultLatency,
});
