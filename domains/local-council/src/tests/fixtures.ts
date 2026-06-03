import { createUserId, mergeFixture } from "@flex/testing";
import type { DeepPartial } from "@flex/utils";
import type {
  LocalAuthority,
  ParentAuthority,
  Tier,
} from "@schemas/local-authority";

export { createUserId };
export const userId = createUserId();

export const createLocalCouncilId = (value = "test-localcouncil-id") => value;
export const localCouncilId = createLocalCouncilId();

export const createTier = (value: Tier = "county") => value;
export const tier = createTier();

export const createParentAuthority = (
  overrides?: DeepPartial<ParentAuthority>,
) =>
  mergeFixture<ParentAuthority>(
    {
      name: "Derbyshire County Council",
      homepage_url: "https://www.derbyshire.gov.uk/",
      tier,
      slug: "derbyshire",
    },
    overrides,
  );
export const parentAuthority = createParentAuthority();

export const createLocalAuthority = (overrides?: DeepPartial<LocalAuthority>) =>
  mergeFixture<LocalAuthority>(
    {
      local_authority: {
        name: "Derbyshire Dales District Council",
        homepage_url: "https://www.derbyshiredales.gov.uk/",
        tier: "district",
        slug: "derbyshire-dales",
        parent: parentAuthority,
      },
    },
    overrides,
  );
export const localAuthority = createLocalAuthority();
