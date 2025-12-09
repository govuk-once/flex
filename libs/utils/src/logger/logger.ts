import { Logger } from '@aws-lambda-powertools/logger';
import { search } from '@aws-lambda-powertools/logger/correlationId';

export const logger = new Logger({
  correlationIdSearchFn: search,
});
