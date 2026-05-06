import { route } from "@domain";

export const handler = route("GET /v1/sdk-lazy", async () => {
  const { SSMClient } = await import("@aws-sdk/client-ssm");
  const ssmClient = new SSMClient({});
  return {
    status: 200,
    data: { ok: true, region: ssmClient.config.region.toString() },
  };
});
