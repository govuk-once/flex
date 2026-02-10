import type { DomainResource } from "./types";

export const resource = {
  secret: (path: string): DomainResource<"secret"> => ({
    type: "secret",
    path,
  }),
  ssm: (
    path: string,
    { resolution }: { resolution?: "deferred" } = {},
  ): DomainResource<"ssm" | "ssm:deferred"> => ({
    type: resolution === "deferred" ? "ssm:deferred" : "ssm",
    path,
  }),
  kms: (path: string): DomainResource<"kms"> => ({ type: "kms", path }),
} as const;
