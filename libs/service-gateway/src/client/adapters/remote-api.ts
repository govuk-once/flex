import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import type { ApiResult } from "@flex/flex-fetch";
import { typedFetch } from "@flex/flex-fetch";
import type { Json } from "@flex/utils";
import { extractQueryParams } from "@flex/utils";

import type {
  GatewayResource,
  GatewayResources,
  RemoteApiDownstream,
  RemoteApiRequest,
} from "../../types";
import { buildFetcher } from "../fetchers/build-fetcher";

export async function createRemoteApiClient(
  downstream: RemoteApiDownstream,
  resources: GatewayResources,
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

function getDownstreamResource(
  ref: string,
  resources: GatewayResources,
): GatewayResource {
  const resource = resources[ref];

  if (resource?.type !== "secret") {
    throw new Error(
      `downstream "ref" must reference a "secret" resource: "${ref}"`,
    );
  }

  return resource;
}

function getResourceArn({ path, env }: GatewayResource) {
  if (!env) {
    throw new Error(
      `Resource "env" is missing and cannot be resolved: "${path}"`,
    );
  }

  const value = process.env[env];

  if (!value) {
    throw new Error(
      `Environment variable "${env}" is not set, check if "${path}" exists`,
    );
  }

  return value;
}

async function loadDownstreamConfig(secretArn: string) {
  const config = await getSecret(secretArn, { maxAge: 600, transform: "json" });

  if (!config) {
    throw new Error(`Downstream config not found: "${secretArn}"`);
  }

  return config;
}
