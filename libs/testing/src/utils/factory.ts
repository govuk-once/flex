import type { DeepPartial } from "@flex/utils";
import { mergeDeepLeft } from "ramda";

type FixtureBuilder<T> = (overrides?: DeepPartial<T>) => T;

export function createFixtureBuilder<Base extends object>(
  base: Base,
): FixtureBuilder<Base> {
  return (overrides): Base => mergeDeepLeft(overrides ?? {}, base) as Base;
}

export function createFixtureFactory<
  Base extends object,
  Variants extends Record<string, (...args: never[]) => Base>,
>(base: Base, variants: (build: FixtureBuilder<Base>) => Variants) {
  const build = createFixtureBuilder(base);
  return Object.assign(build, variants(build));
}
