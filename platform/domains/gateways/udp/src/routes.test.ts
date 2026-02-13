import { describe, it, expect } from "vitest";
import { matchRemoteRoute } from "./routes";

describe("matchRemoteRoute", () => {
    it.each(
        ["/v1/notifications", { remotePath: "/v1/notifications", method: "POST" }],
        ["/v1/analytics", { remotePath: "/v1/analytics", method: "POST" }],
        ["/v1/preferences", { remotePath: "/v1/preferences", method: "POST" }],
    )("should match the remote path and method", (path, expected) => {
        const result = matchRemoteRoute(path);

        expect(result).toEqual(expected);
    });
});
