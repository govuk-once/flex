import {
  OmitPropsWithSuffix,
  OnlyPropsWithSuffix,
  Simplify,
  WithoutPropSuffix,
} from "@flex/utils";

export function splitBySuffix<T extends object, SUFFIX extends string>(
  obj: T,
  suffix: SUFFIX,
): [
  Simplify<OnlyPropsWithSuffix<T, SUFFIX>>,
  Simplify<OmitPropsWithSuffix<T, SUFFIX>>,
] {
  const [withSuffix, withoutSuffix] = Object.entries(obj).reduce<
    [Record<string, unknown>, Record<string, unknown>]
  >(
    ([withSuffix, withoutSuffix], [key, value]) => {
      const entryObject = key.endsWith(suffix) ? withSuffix : withoutSuffix;
      entryObject[key] = value;
      return [withSuffix, withoutSuffix];
    },
    [{}, {}],
  );

  return [
    withSuffix as Simplify<OnlyPropsWithSuffix<T, SUFFIX>>,
    withoutSuffix as Simplify<OmitPropsWithSuffix<T, SUFFIX>>,
  ];
}

export function removeSuffixFromFields<T extends object, SUFFIX extends string>(
  object: T,
  suffix: SUFFIX,
): WithoutPropSuffix<T, SUFFIX> {
  const entriesWithoutSuffix = Object.entries(object).map(([key, value]) => {
    if (key.endsWith(suffix)) {
      return [key.slice(0, -suffix.length), value] as [string, unknown];
    }
    return [key, value] as [string, unknown];
  });

  return Object.fromEntries(entriesWithoutSuffix) as WithoutPropSuffix<
    T,
    SUFFIX
  >;
}
