import { createSigv4FetchWithCredentials } from "@flex/flex-fetch";
import { assertNever, NonEmptyString } from "@flex/utils";
import type { DownstreamAuth } from "@types";
import z from "zod";

import { createPublicFetch } from "./public-fetcher";

const PublicFetcherSchema = z.object({ apiUrl: NonEmptyString });
const Sigv4FetcherSchema = z.object({
  apiUrl: NonEmptyString,
  region: NonEmptyString,
  roleArn: NonEmptyString,
  externalId: NonEmptyString.optional(),
});

export function buildFetcher(config: unknown, auth: DownstreamAuth) {
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
