import type { DeepPartial } from "@flex/utils";
import { mergeDeepLeft } from "ramda";

export function mergeFixture<Base extends object>(
  base: Base,
  overrides?: DeepPartial<Base>,
) {
  return mergeDeepLeft(overrides ?? {}, base) as unknown as Base;
}
