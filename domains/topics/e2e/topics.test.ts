import { isDomainDeployed, isRouteDeployed } from "@flex/sdk";
import { it } from "@flex/testing/e2e";
import {
  UpdateSelectedTopicsRequest,
  UpdateSelectedTopicsRequestSchema,
  UpdateSelectedTopicsResponse,
  UpdateSelectedTopicsResponseSchema,
} from "@schemas/topic";
import { describe, expect } from "vitest";

import { config as topicsConfig } from "../domain.config";

describe.runIf(isDomainDeployed(topicsConfig))("Topics domain", () => {
  describe("/topics/v1/topics", () => {
    const endpoint = "/topics/v1/topics";

    describe.runIf(isRouteDeployed(topicsConfig, "PATCH /v1/topics"))(
      "PATCH",
      () => {
        it("returns 204 with updated selectedTopics", async ({
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

          expect(
            UpdateSelectedTopicsRequestSchema.safeParse(requestTopics).success,
          ).toBe(true);

          const result = await cloudfront.client.patch<
            UpdateSelectedTopicsRequest,
            UpdateSelectedTopicsResponse
          >(endpoint, {
            headers: authHeader,
            body: requestTopics,
          });

          expect(result.status).toBe(204);
          expect(
            UpdateSelectedTopicsResponseSchema.safeParse(result.body).success,
          ).toBe(true);

          expect(result.body).toStrictEqual({
            topics: {
              selectedTopics: [
                { id: "topic-1", title: "Topic One" },
                { id: "topic-2", title: "Topic Two" },
              ],
            },
          });
        });

        it("returns 204 with cleared selectedTopics", async ({
          cloudfront,
          udpUser: _,
          authHeader,
        }) => {
          const requestTopics = {
            topics: {
              selectedTopics: [],
            },
          };

          expect(
            UpdateSelectedTopicsRequestSchema.safeParse(requestTopics).success,
          ).toBe(true);

          const result = await cloudfront.client.patch<
            UpdateSelectedTopicsRequest,
            UpdateSelectedTopicsResponse
          >(endpoint, {
            headers: authHeader,
            body: requestTopics,
          });

          expect(result.status).toBe(204);
          expect(
            UpdateSelectedTopicsResponseSchema.safeParse(result.body).success,
          ).toBe(true);

          expect(result.body).toStrictEqual({
            topics: {
              selectedTopics: [],
            },
          });
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
