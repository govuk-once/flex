import type { ApiResponse } from "@flex/testing/e2e";
import { extendIt } from "@flex/testing/e2e";
import type { GetUserResponse } from "@flex/udp-domain";

interface UdpFixtures {
  udpUser: GetUserResponse;
  withCleanIdentity: (service: string) => Promise<void>;
  withIdentityLink: (
    service: string,
    id: string,
  ) => Promise<ApiResponse<unknown>>;
}

export const it = extendIt().extend<UdpFixtures>({
  udpUser: async ({ cloudfront, authHeader }, use) => {
    const result = await cloudfront.client.get<GetUserResponse>(
      "/udp/v1/users/me",
      {
        headers: authHeader,
      },
    );
    await use(result.body as GetUserResponse);
  },

  withCleanIdentity: async ({ cloudfront, udpUser: _, authHeader }, use) => {
    const trackedServices = new Set<string>();

    const clean = async (service: string): Promise<void> => {
      const result = await cloudfront.client.delete(
        `/udp/v1/identity/${service}`,
        { headers: authHeader },
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
        headers: authHeader,
      });
    }
  },

  withIdentityLink: async ({ cloudfront, udpUser: _, authHeader }, use) => {
    const trackedServices = new Set<string>();

    const link = async (
      service: string,
      id: string,
    ): Promise<ApiResponse<unknown>> => {
      await cloudfront.client.delete(`/udp/v1/identity/${service}`, {
        headers: authHeader,
      });
      trackedServices.add(service);
      return cloudfront.client.post(`/udp/v1/identity/${service}`, {
        headers: {
          ...authHeader,
          "x-linking-token": id,
        },
      });
    };

    await use(link);

    for (const service of trackedServices) {
      await cloudfront.client.delete(`/udp/v1/identity/${service}`, {
        headers: authHeader,
      });
    }
  },
});
