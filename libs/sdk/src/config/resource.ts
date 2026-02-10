import type {
  DomainResource,
  SecretResourceOptions,
  SsmResourceOptions,
} from "../types";

export const resource = {
  secret: (
    path: string,
    { scope = "environment" }: SecretResourceOptions = {},
  ): DomainResource<"secret"> => ({ type: "secret", path, scope }),
  ssm: (
    path: string,
    { scope = "environment", resolution = "deploy" }: SsmResourceOptions = {},
  ): DomainResource<"ssm"> | DomainResource<"ssm:runtime"> => ({
    type: resolution === "deploy" ? "ssm" : "ssm:runtime",
    path,
    scope,
  }),
  kms: (path: string): DomainResource<"kms"> => ({ type: "kms", path }),
} as const;
