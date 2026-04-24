import type { ApiResponse } from "@flex/testing/e2e";
import { extendIt } from "@flex/testing/e2e";
import type { GetUserResponse } from "@flex/udp-domain";
import { inject } from "vitest";

interface UdpFixtures {
  udpUser: GetUserResponse;
  withCleanIdentity: (service: string) => Promise<void>;
  withIdentityLink: (
    service: string,
    id: string,
  ) => Promise<ApiResponse<unknown>>;
}

export const it = extendIt().extend<UdpFixtures>({
  udpUser: async ({ cloudfront }, use) => {
    const { JWT } = inject("e2eEnv");
    const result = await cloudfront.client.get<GetUserResponse>(
      "/udp/v1/users",
      {
        headers: { Authorization: `Bearer ${JWT.VALID}` },
      },
    );
    await use(result.body as GetUserResponse);
  },

  withCleanIdentity: async ({ cloudfront, udpUser: _ }, use) => {
    const { JWT } = inject("e2eEnv");
    const authorization = { Authorization: `Bearer ${JWT.VALID}` };
    const trackedServices = new Set<string>();

    const clean = async (service: string): Promise<void> => {
      const result = await cloudfront.client.delete(
        `/udp/v1/identity/${service}`,
        { headers: authorization },
      );
      if (![204, 404].includes(result.status)) {
        throw new Error(
          `Unexpected identity cleanup status: ${result.status.toString()}`,
        );
      }
      trackedServices.add(service);
    };

    await use(clean);

    for (const service of trackedServices) {
      await cloudfront.client.delete(`/udp/v1/identity/${service}`, {
        headers: authorization,
      });
    }
  },

  withIdentityLink: async ({ cloudfront, udpUser: _ }, use) => {
    const { JWT } = inject("e2eEnv");
    const authorization = { Authorization: `Bearer ${JWT.VALID}` };
    const trackedServices = new Set<string>();

    const link = async (
      service: string,
      id: string,
    ): Promise<ApiResponse<unknown>> => {
      await cloudfront.client.delete(`/udp/v1/identity/${service}`, {
        headers: authorization,
      });
      trackedServices.add(service);
      return cloudfront.client.post(`/udp/v1/identity/${service}/${id}`, {
        headers: authorization,
      });
    };

    await use(link);

    for (const service of trackedServices) {
      await cloudfront.client.delete(`/udp/v1/identity/${service}`, {
        headers: authorization,
      });
    }
  },
});
