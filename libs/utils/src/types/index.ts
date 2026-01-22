/**
 * Make all properties in an object type optional, recursively.
 */
export type DeepPartial<T> = T extends (...args: unknown[]) => unknown
  ? T
  : T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

/**
 * Remove a specific suffix from a string type.
 */
export type WithoutSuffix<
  T,
  SUFFIX extends string,
> = T extends `${infer P}${SUFFIX}` ? P : T;

/**
 * Remove a specific suffix from all keys in an object type recursively.
 */
export type WithoutPropSuffix<T, SUFFIX extends string> = {
  [K in keyof T as WithoutSuffix<K, SUFFIX>]: T[K] extends object
    ? WithoutPropSuffix<T[K], SUFFIX>
    : T[K];
};

/**
 * Simplify a type by resolving intersections and flattening mapped types.
 * This is useful for improving readability of complex types in IDEs.
 */
export type Simplify<T> = T extends object
  ? {
      [P in keyof T]: Simplify<T[P]>;
    }
  : T;
