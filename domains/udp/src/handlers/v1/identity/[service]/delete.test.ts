import { it } from "@flex/testing";
import type { GetServiceIdentityLinkResponse } from "@schemas/identity";
import { userId } from "@tests/fixtures";
import status from "http-status";
import { describe, expect } from "vitest";

import { handler } from "./delete";

describe("DELETE /v1/identity/:service", () => {
  const serviceName = "test-service";
  const serviceId = "test-service-id";
  const endpoint = `/identity/${serviceName}`;

  const foundServiceIdentityLink: GetServiceIdentityLinkResponse = {
    serviceId,
    serviceName,
  };

  describe("response", () => {
    it("returns 204 when an existing service identity is unlinked and removed from tracking list", async ({
      http,
      sdk,
    }) => {
      http
        .gateway("udp")
        .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
        .reply(status.OK, foundServiceIdentityLink);

      http
        .gateway("udp")
        .get(`/identities/${userId}`)
        .reply(status.OK, {
          data: { services: [serviceName, "another-active-service"] },
        });

      http
        .gateway("udp")
        .delete(
          `/identity/${foundServiceIdentityLink.serviceName}/${foundServiceIdentityLink.serviceId}`,
        )
        .reply(status.NO_CONTENT);

      http
        .gateway("udp")
        .post(`/identities/${userId}`, {
          data: { services: ["another-active-service"] },
        })
        .reply(status.OK);

      const result = await handler(
        sdk.event.delete(endpoint, {
          userId,
          params: { service: serviceName },
        }),
        sdk.context(),
      );

      expect(result).toStrictEqual({ statusCode: status.NO_CONTENT, body: "" });
    });

    it("returns 204 and clears list gracefully if target identity is the last element remaining", async ({
      http,
      sdk,
    }) => {
      http
        .gateway("udp")
        .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
        .reply(status.OK, foundServiceIdentityLink);

      http
        .gateway("udp")
        .get(`/identities/${userId}`)
        .reply(status.OK, {
          data: { services: [serviceName] },
        });

      http
        .gateway("udp")
        .delete(
          `/identity/${foundServiceIdentityLink.serviceName}/${foundServiceIdentityLink.serviceId}`,
        )
        .reply(status.NO_CONTENT);

      http
        .gateway("udp")
        .post(`/identities/${userId}`, {
          data: { services: [] },
        })
        .reply(status.OK);

      const result = await handler(
        sdk.event.delete(endpoint, {
          userId,
          params: { service: serviceName },
        }),
        sdk.context(),
      );

      expect(result).toStrictEqual({ statusCode: status.NO_CONTENT, body: "" });
    });

    it("returns 204 gracefully when identity link exists but the identities tracking list is already empty on remove", async ({
      http,
      sdk,
    }) => {
      http
        .gateway("udp")
        .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
        .reply(status.OK, foundServiceIdentityLink);

      http.gateway("udp").get(`/identities/${userId}`).reply(status.NOT_FOUND);

      http
        .gateway("udp")
        .delete(
          `/identity/${foundServiceIdentityLink.serviceName}/${foundServiceIdentityLink.serviceId}`,
        )
        .reply(status.NO_CONTENT);

      const result = await handler(
        sdk.event.delete(endpoint, {
          userId,
          params: { service: serviceName },
        }),
        sdk.context(),
      );

      expect(result).toStrictEqual({ statusCode: status.NO_CONTENT, body: "" });
    });
  });

  describe("errors", () => {
    it("returns 404 when an identity link does not exist", async ({
      http,
      sdk,
    }) => {
      http
        .gateway("udp")
        .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
        .reply(status.NOT_FOUND);

      const result = await handler(
        sdk.event.delete(endpoint, {
          userId,
          params: { service: serviceName },
        }),
        sdk.context(),
      );

      expect(result).toStrictEqual({ statusCode: status.NOT_FOUND, body: "" });
    });

    it("returns 502 when the UDP identity link integration fails", async ({
      http,
      sdk,
    }) => {
      http
        .gateway("udp")
        .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
        .reply(status.INTERNAL_SERVER_ERROR);

      const result = await handler(
        sdk.event.delete(endpoint, {
          userId,
          params: { service: serviceName },
        }),
        sdk.context(),
      );

      expect(result).toStrictEqual({
        statusCode: status.BAD_GATEWAY,
        body: "",
      });
    });

    it("returns 502 when the UDP identity unlink integration fails", async ({
      http,
      sdk,
    }) => {
      http
        .gateway("udp")
        .get(`/identity/${serviceName}`, { headers: { "User-Id": userId } })
        .reply(status.OK, foundServiceIdentityLink);

      http
        .gateway("udp")
        .get(`/identities/${userId}`)
        .reply(status.OK, { data: { services: [serviceName] } });

      http
        .gateway("udp")
        .delete(
          `/identity/${foundServiceIdentityLink.serviceName}/${foundServiceIdentityLink.serviceId}`,
        )
        .reply(status.INTERNAL_SERVER_ERROR);

      const result = await handler(
        sdk.event.delete(endpoint, {
          userId,
          params: { service: serviceName },
        }),
        sdk.context(),
      );

      expect(result).toStrictEqual({
        statusCode: status.BAD_GATEWAY,
        body: "",
      });
    });
  });
});
