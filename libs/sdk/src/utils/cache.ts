export function cache<Fn>(fn: () => Fn): () => Fn {
  let result: Fn;
  let called: boolean = false;

  return () => {
    if (!called) {
      result = fn();
      called = true;
    }

    return result;
  };
}
