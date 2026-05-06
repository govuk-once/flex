import { SSMClient } from "@aws-sdk/client-ssm";
import { route } from "@domain";

const ssmClient = new SSMClient({});

export const handler = route("GET /v1/sdk-eager-512mb", () =>
  Promise.resolve({
    status: 200,
    data: { ok: true, region: ssmClient.config.region.toString() },
  }),
);
