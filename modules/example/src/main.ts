import { handler as exampleHandler } from './app/example';

/* eslint-disable  @typescript-eslint/no-explicit-any */
export const handler = async (event: any) => {
  console.log('Event received:', event);
  return await exampleHandler(event);
};
