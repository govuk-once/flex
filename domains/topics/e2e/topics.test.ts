import { isDomainDeployed, isRouteDeployed } from "@flex/sdk";
import { it } from "@flex/testing/e2e";
import {
  GetSelectedTopicsResponse,
  UpdateSelectedTopicsRequest,
  UpdateSelectedTopicsResponse,
} from "@schemas/topic";
import { describe, expect } from "vitest";

import { config as topicsConfig } from "../domain.config";

describe.runIf(isDomainDeployed(topicsConfig))("Topics domain", () => {
  describe("/topics/v1/topics", () => {
    const endpoint = "/topics/v1/topics";

    describe.runIf(isRouteDeployed(topicsConfig, "GET /v1/topics"))(
      "GET",
      () => {
        it("returns 200 with selected topics", async ({
          cloudfront,
          udpUser: _,
          authHeader,
        }) => {
          const requestTopics = {
            topics: {
              selectedTopics: [
                { id: "topic-1", title: "Topic One" },
                { id: "topic-2", title: "Topic Two" },
              ],
            },
          };

          await cloudfront.client.patch(endpoint, {
            headers: authHeader,
            body: requestTopics,
          });

          const result = await cloudfront.client.get<GetSelectedTopicsResponse>(
            endpoint,
            { headers: authHeader },
          );

          expect(result.status).toBe(200);
          expect(result.body).toStrictEqual(requestTopics);
        });

        it("returns 401 when no auth is provided", async ({ cloudfront }) => {
          const result = await cloudfront.client.get(endpoint);

          expect(result.status).toBe(401);
        });
      },
    );

    describe.runIf(isRouteDeployed(topicsConfig, "PATCH /v1/topics"))(
      "PATCH",
      () => {
        it("returns 204 with updated selected topics", async ({
          cloudfront,
          udpUser: _,
          authHeader,
        }) => {
          const requestTopics = {
            topics: {
              selectedTopics: [
                { id: "topic-1", title: "Topic One" },
                { id: "topic-2", title: "Topic Two" },
              ],
            },
          };

          const result = await cloudfront.client.patch<
            UpdateSelectedTopicsRequest,
            UpdateSelectedTopicsResponse
          >(endpoint, {
            headers: authHeader,
            body: requestTopics,
          });

          expect(result.status).toBe(204);
        });

        it("returns 204 with cleared selected topics", async ({
          cloudfront,
          udpUser: _,
          authHeader,
        }) => {
          const requestTopics = {
            topics: {
              selectedTopics: [],
            },
          };

          const result = await cloudfront.client.patch<
            UpdateSelectedTopicsRequest,
            UpdateSelectedTopicsResponse
          >(endpoint, {
            headers: authHeader,
            body: requestTopics,
          });

          expect(result.status).toBe(204);
        });

        it("returns 401 when no auth is provided", async ({ cloudfront }) => {
          const requestTopics = {
            topics: {
              selectedTopics: [],
            },
          };

          const result = await cloudfront.client.patch<
            UpdateSelectedTopicsRequest,
            UpdateSelectedTopicsResponse
          >(endpoint, {
            body: requestTopics,
          });

          expect(result.status).toBe(401);
        });

        it("returns 400 when the request body is invalid", async ({
          cloudfront,
          udpUser: _,
          authHeader,
        }) => {
          const result = await cloudfront.client.patch(endpoint, {
            headers: authHeader,
            body: {},
          });

          expect(result.status).toBe(400);
        });
      },
    );
  });
});
