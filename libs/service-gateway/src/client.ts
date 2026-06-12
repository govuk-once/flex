import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import type { ApiResult } from "@flex/flex-fetch";
import { createSigv4FetchWithCredentials, typedFetch } from "@flex/flex-fetch";
import type { Json } from "@flex/utils";
import { extractQueryParams, NonEmptyString } from "@flex/utils";
import z from "zod";

import { createPublicFetch } from "./create-public-fetch";
import type {
  DownstreamClient,
  EventBusDownstream,
  EventBusRequest,
  GatewayConfig,
  GatewayDownstream,
  GatewayResource,
  GatewayResources,
  RemoteApiAuth,
  RemoteApiDownstream,
  RemoteApiRequest,
} from "./types";

export function createDownstreamClient<Config extends GatewayConfig>(
  config: Config,
) {
  return buildClient(
    config.name,
    config.downstream,
    config.resources,
  ) as Promise<DownstreamClient<Config>>;
}

function buildClient(
  name: string,
  downstream: GatewayDownstream,
  resources?: GatewayResources,
) {
  switch (downstream.type) {
    case "remote-api":
      return createRemoteApiClient(downstream, resources);
    case "event-bus":
      return createEventBusClient(name, downstream);
    default:
      return assertNever(downstream);
  }
}

async function createRemoteApiClient(
  downstream: RemoteApiDownstream,
  resources?: GatewayResources,
) {
  const resource = getDownstreamResource(downstream.ref, resources);
  const resourceArn = getResourceArn(resource);

  const rawConfig = await loadDownstreamConfig(resourceArn);

  const config = resource.config ? resource.config.parse(rawConfig) : rawConfig;

  const fetcher = buildFetcher(config, downstream.auth);

  return {
    config,
    request: <Out, In extends Json = Json>(
      input: RemoteApiRequest<In>,
    ): Promise<ApiResult<Out>> => {
      const { method, path, headers, query } = input;

      const url = query ? `${path}?${extractQueryParams(query)[0]}` : path;

      const { request } = fetcher(url, {
        method,
        headers: { Accept: "application/json", ...headers },
        body: JSON.stringify("body" in input ? input.body : undefined),
      });

      return typedFetch(request);
    },
  };
}

// eslint-disable-next-line @typescript-eslint/require-await
async function createEventBusClient(name: string, _: EventBusDownstream) {
  return {
    request: (_: EventBusRequest): Promise<ApiResult<unknown>> => {
      throw new Error(`"${name}" event-bus client not yet implemented`);
    },
  };
}

async function loadDownstreamConfig(secretArn: string) {
  const config = await getSecret(secretArn, { maxAge: 600, transform: "json" });

  if (!config) {
    throw new Error(`Downstream config not found: "${secretArn}"`);
  }

  return config;
}

function getDownstreamResource(
  ref: string,
  resources?: GatewayResources,
): GatewayResource {
  const resource = resources?.[ref];

  if (resource?.type !== "secret") {
    throw new Error(
      `downstream "ref" must reference a "secret" resource: "${ref}"`,
    );
  }

  return resource;
}

function getResourceArn({ path, env }: GatewayResource): string {
  if (!env) {
    throw new Error(
      `Resource "${path}" has no "env" to resolve its runtime value.`,
    );
  }

  const value = process.env[env];

  if (!value) {
    throw new Error(
      `Environment variable "${env}" is not set, check if "${path}" exists.`,
    );
  }

  return value;
}

const PublicFetcherSchema = z.object({ apiUrl: NonEmptyString });
const Sigv4FetcherSchema = z.object({
  apiUrl: NonEmptyString,
  region: NonEmptyString,
  roleArn: NonEmptyString,
  externalId: NonEmptyString.optional(),
});

function buildFetcher(config: unknown, auth: RemoteApiAuth) {
  switch (auth.type) {
    case "public": {
      const { apiUrl } = PublicFetcherSchema.parse(config);

      return createPublicFetch({ baseUrl: apiUrl });
    }
    case "sigv4": {
      const { apiUrl, region, roleArn, externalId } =
        Sigv4FetcherSchema.parse(config);

      return createSigv4FetchWithCredentials({
        baseUrl: apiUrl,
        region,
        roleArn,
        roleName: auth.roleName,
        externalId,
      });
    }
    default:
      return assertNever(auth);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
