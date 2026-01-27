import { describe, expect, it } from "vitest";

import { generateDerivedId } from "./derived-id";

describe("generateDerivedId", () => {
  const pairwiseId = "test-pairwise-id";
  const secretKey = "test-secret-key-32-chars-minimum"; // pragma: allowlist secret

  it("generates a deterministic ID for the same inputs", () => {
    const id1 = generateDerivedId({ pairwiseId, secretKey });
    const id2 = generateDerivedId({ pairwiseId, secretKey });

    expect(id1).toBe(id2);
  });

  it("generates different IDs for different pairwise IDs", () => {
    const id1 = generateDerivedId({
      pairwiseId: "pairwise-1",
      secretKey,
    });
    const id2 = generateDerivedId({
      pairwiseId: "pairwise-2",
      secretKey,
    });

    expect(id1).not.toBe(id2);
  });

  it("generates different IDs for different secret keys", () => {
    const id1 = generateDerivedId({
      pairwiseId,
      secretKey: "secret-key-1-32-chars-minimum", // pragma: allowlist secret
    });
    const id2 = generateDerivedId({
      pairwiseId,
      secretKey: "secret-key-2-32-chars-minimum", // pragma: allowlist secret
    });

    expect(id1).not.toBe(id2);
  });

  it("generates base64url encoded output (URL-safe)", () => {
    const id = generateDerivedId({ pairwiseId, secretKey });

    // Base64URL should not contain +, /, or = characters
    expect(id).not.toContain("+");
    expect(id).not.toContain("/");
    expect(id).not.toContain("=");
  });

  it("generates IDs of consistent length", () => {
    const id1 = generateDerivedId({
      pairwiseId: "short",
      secretKey,
    });
    const id2 = generateDerivedId({
      pairwiseId: "very-long-pairwise-id-with-many-characters",
      secretKey,
    });

    // HMAC-SHA256 produces 32 bytes, base64url encoded is 43 characters
    expect(id1.length).toBe(43);
    expect(id2.length).toBe(43);
  });
});
