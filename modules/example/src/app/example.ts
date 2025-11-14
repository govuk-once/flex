import { IGreetings, Greetings } from '@libs/utils';

/* eslint-disable  @typescript-eslint/no-explicit-any */
export async function handler(event: any) {
  const message: IGreetings = new Greetings();
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: message.getGreetings(),
      input: event,
    }),
  };
}
