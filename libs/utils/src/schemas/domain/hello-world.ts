import { z } from 'zod';

import { NonEmptyString } from '../common';

export const HelloWorldInput = z.object({
  // query: z.object({})
});
export type HelloWorldInput = z.output<typeof HelloWorldInput>;

export const HelloWorldOutput = z.object({
  body: z.object({
    message: NonEmptyString,
  }),
});
export type HelloWorldOutput = z.output<typeof HelloWorldOutput>;
