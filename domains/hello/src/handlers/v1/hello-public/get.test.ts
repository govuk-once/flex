import { context, it } from "@flex/testing";
import { describe, expect, vi } from "vitest";

import { handler } from "./get";

vi.mock("@flex/params", () => ({
  getConfig: vi.fn().mockResolvedValue({
    featureFlags: { ENABLED: true, DISABLED: false },
  }),
}));

describe("Hello World handler (public)", () => {
  it("GET /hello-public returns Hello public world!", async ({ event }) => {
    const response = await handler(event.get("/hello-public"), context);

    expect(response).toEqual({
      statusCode: 200,
      body: JSON.stringify({
        message: "Hello public world!",
        featureFlags: { enabled: true, disabled: false },
      }),
    });
  });
});
