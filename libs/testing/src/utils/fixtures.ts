import type { DeepPartial } from "@flex/utils";
import { mergeDeepLeft } from "ramda";

export function mergeFixture<Base extends object>(
  base: Base,
  overrides?: DeepPartial<Base>,
) {
  return mergeDeepLeft(overrides ?? {}, base) as unknown as Base;
}

export type FixtureBuilder<Base extends object> = (
  overrides?: DeepPartial<Base>,
) => Base;

export function createFixtureBuilder<Base extends object>(
  base: Base,
): FixtureBuilder<Base> {
  return (overrides) => mergeFixture(base, overrides);
}

type FixtureVariantMap<Base extends object> = Record<
  string,
  (...args: never[]) => Base
>;

export type FixtureVariants<
  Base extends object,
  Variants extends FixtureVariantMap<Base>,
> = FixtureBuilder<Base> & Variants;

export function createFixtureVariants<
  Base extends object,
  Variants extends FixtureVariantMap<Base>,
>(
  base: Base,
  variants: (build: FixtureBuilder<Base>) => Variants,
): FixtureVariants<Base, Variants> {
  const build = createFixtureBuilder(base);
  return Object.assign(build, variants(build));
}
