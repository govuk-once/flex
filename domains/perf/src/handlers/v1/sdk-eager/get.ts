import { SSMClient } from "@aws-sdk/client-ssm";
import { route } from "@domain";

const ssmClient = new SSMClient({});

export const handler = route("GET /v1/sdk-eager", () =>
  Promise.resolve({
    status: 200,
    data: { ok: true, region: ssmClient.config.region.toString() },
  }),
);
