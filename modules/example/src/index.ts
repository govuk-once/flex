import { Event, response } from './types';

export const handler = async (event: Event): Promise<response> => {
  console.log('Event received:', event);

  return {
    statusCode: 200,
  };
};
