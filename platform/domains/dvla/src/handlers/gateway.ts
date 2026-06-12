import { createHandler } from "@gateway";

export const handler = createHandler({
  "GET /v1/authenticate": {
    transformRequest: (draft, { merge, source: _ }) => {
      // @ts-expect-error not yet implemented
      return merge(draft, {
        // overrides
      });
    },
    transformResponse: (draft, { merge, source: _ }) => {
      // @ts-expect-error not yet implemented
      return merge(draft, {
        // overrides
      });
    },
  },
});
