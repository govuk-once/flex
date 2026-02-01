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

/**
 * Generate a union type of numbers from 0 up to (but not including) N.
 * Does NOT work with negative numbers.
 * Does not allow for arbitrarily large numbers due to limitations of type engine
 *
 * Good for limiting a number up to a certain point
 */
export type NumberUpTo<
  End extends number,
  Range extends number[] = [],
> = Range["length"] extends End
  ? Range[number]
  : NumberUpTo<End, [...Range, Range["length"]]>;

/**
 * Generate a union type of numbers from F up to (but not including) T.
 * Does NOT work with negative numbers.
 * Does not allow for arbitrarily large numbers due to limitations of type engine
 *
 * Good for restricting literal number values
 */
export type NumberBetween<From extends number, To extends number> = Exclude<
  NumberUpTo<To>,
  NumberUpTo<From>
>;

type J = NumberBetween<3, 10>;
