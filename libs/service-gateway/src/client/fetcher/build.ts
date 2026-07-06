import { createSigv4FetchWithCredentials } from "@flex/sdk";
import { assertNever } from "@flex/utils";

import { createPublicFetch } from "./public";

export type RestAuth =
  | { type: "public" }
  | {
      type: "sigv4";
      region: string;
      roleArn: string;
      roleName: string;
      externalId?: string;
    };

interface BuildFetcherOptions {
  baseUrl: string;
  auth: RestAuth;
}

type Fetcher = ReturnType<typeof createPublicFetch>;

export function buildFetcher({ baseUrl, auth }: BuildFetcherOptions): Fetcher {
  switch (auth.type) {
    case "public":
      return createPublicFetch({ baseUrl });
    case "sigv4": {
      const { region, roleArn, roleName, externalId } = auth;

      return createSigv4FetchWithCredentials({
        baseUrl,
        region,
        roleArn,
        roleName,
        externalId,
      });
    }
    default:
      return assertNever(auth);
  }
}
