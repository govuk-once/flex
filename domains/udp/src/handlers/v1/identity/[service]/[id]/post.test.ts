import { it } from "@flex/testing";
import type {
  CreateServiceIdentityLinkRequest,
  GetServiceIdentityLinkResponse,
} from "@schemas/identity";
import { userId } from "@tests/fixtures";
import status from "http-status";
import { describe, expect } from "vitest";

import { handler } from "./post";

describe("POST /v1/identity/:service/:id", () => {
  const service = "test-service";
  const serviceId = "test-service-id";
  const endpoint = `/identity/${service}/${serviceId}`;
  const body: CreateServiceIdentityLinkRequest = { appId: userId };

  describe("response", () => {
    it("returns 201 when a new service identity is linked and appended to the tracking list", async ({
      http,
      sdk,
    }) => {
      http
        .gateway("udp")
        .get(`/identity/${service}`, { headers: { "User-Id": userId } })
        .reply(status.NOT_FOUND);

      http.gateway("udp").get(`/identities/${userId}`).reply(status.NOT_FOUND);

      http
        .gateway("udp")
        .post(`/identity/${service}/${serviceId}`, body)
        .reply(status.CREATED);

      http
        .gateway("udp")
        .post(`/identities/${userId}`, {
          data: { services: [service] },
        })
        .reply(status.OK);

      const result = await handler(
        sdk.event.post(endpoint, {
          userId,
          body,
          params: { service, id: serviceId },
        }),
        sdk.context(),
      );

      expect(result).toStrictEqual({ statusCode: status.CREATED, body: "" });
    });

    it("returns 201 and skips appending the list when the service is already present in the tracking list collection", async ({
      http,
      sdk,
    }) => {
      http
        .gateway("udp")
        .get(`/identity/${service}`, { headers: { "User-Id": userId } })
        .reply(status.NOT_FOUND);

      http
        .gateway("udp")
        .get(`/identities/${userId}`)
        .reply(status.OK, {
          data: { services: [service, "some-other-service"] },
        });

      http
        .gateway("udp")
        .post(`/identity/${service}/${serviceId}`, body)
        .reply(status.CREATED);

      // Fixed string bug to use dynamic template string variable matching main pattern
      http
        .gateway("udp")
        .post(`/identities/${userId}`, {
          data: { services: [service, "some-other-service"] },
        })
        .reply(status.OK);

      const result = await handler(
        sdk.event.post(endpoint, {
          userId,
          body,
          params: { service, id: serviceId },
        }),
        sdk.context(),
      );

      expect(result).toStrictEqual({ statusCode: status.CREATED, body: "" });
    });

    it("returns 204 when the identity is already linked with the same ID (skips appending list)", async ({
      http,
      sdk,
    }) => {
      const existingLink: GetServiceIdentityLinkResponse = {
        serviceId: serviceId,
        serviceName: service,
      };

      http
        .gateway("udp")
        .get(`/identity/${service}`, { headers: { "User-Id": userId } })
        .reply(status.OK, existingLink);

      const result = await handler(
        sdk.event.post(endpoint, {
          userId,
          body,
          params: { service, id: serviceId },
        }),
        sdk.context(),
      );

      expect(result).toStrictEqual({ statusCode: status.NO_CONTENT, body: "" });
    });

    it("returns 201 after unlinking an old ID and appending the new identity profile if absent", async ({
      http,
      sdk,
    }) => {
      const oldId = "old-id";
      const existingLink: GetServiceIdentityLinkResponse = {
        serviceId: oldId,
        serviceName: service,
      };

      http
        .gateway("udp")
        .get(`/identity/${service}`, { headers: { "User-Id": userId } })
        .reply(status.OK, existingLink);

      http
        .gateway("udp")
        .delete(`/identity/${service}/${oldId}`)
        .reply(status.NO_CONTENT);

      http
        .gateway("udp")
        .get(`/identities/${userId}`)
        .reply(status.OK, {
          data: { services: ["existing-other-service"] },
        });

      http
        .gateway("udp")
        .post(`/identity/${service}/${serviceId}`, body)
        .reply(status.CREATED);

      http
        .gateway("udp")
        .post(`/identities/${userId}`, {
          data: { services: ["existing-other-service", service] },
        })
        .reply(status.OK);

      const result = await handler(
        sdk.event.post(endpoint, {
          userId,
          body,
          params: { service, id: serviceId },
        }),
        sdk.context(),
      );

      expect(result).toStrictEqual({ statusCode: status.CREATED, body: "" });
    });
  });

  describe("errors", () => {
    it("returns 502 when the initial check fails", async ({ http, sdk }) => {
      http
        .gateway("udp")
        .get(`/identity/${service}`, { headers: { "User-Id": userId } })
        .reply(status.INTERNAL_SERVER_ERROR);

      const result = await handler(
        sdk.event.post(endpoint, {
          userId,
          body,
          params: { service, id: serviceId },
        }),
        sdk.context(),
      );

      expect(result).toStrictEqual({
        statusCode: status.BAD_GATEWAY,
        body: "",
      });
    });

    it("returns 502 when the identity list post configuration fails", async ({
      http,
      sdk,
    }) => {
      http
        .gateway("udp")
        .get(`/identity/${service}`, { headers: { "User-Id": userId } })
        .reply(status.NOT_FOUND);

      http.gateway("udp").get(`/identities/${userId}`).reply(status.NOT_FOUND);

      http
        .gateway("udp")
        .post(`/identity/${service}/${serviceId}`, body)
        .reply(status.CREATED);

      http
        .gateway("udp")
        .post(`/identities/${userId}`, {
          data: { services: [service] },
        })
        .reply(status.INTERNAL_SERVER_ERROR);

      const result = await handler(
        sdk.event.post(endpoint, {
          userId,
          body,
          params: { service, id: serviceId },
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
