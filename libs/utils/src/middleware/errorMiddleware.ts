import type { MiddlewareObj, Request } from '@middy/core';
import { ParseError } from '@aws-lambda-powertools/parser';
import { Logger } from '@aws-lambda-powertools/logger';
import { StatusCodes, ReasonPhrases } from 'http-status-codes';
import { generateErrorResponse } from '../response/response';

export const gobalErrorMiddleware = (logger: Logger): MiddlewareObj => ({
  onError: (request: Request): void => {
    const { error } = request;

    if (!error) return;

    logger.error(error.name, { error });

    const errorType: ErrorCategory = getErrorCategory(error);

    switch (errorType) {
      case ErrorCategory.BAD_REQUEST:
        request.response = generateErrorResponse({
          status: StatusCodes.BAD_REQUEST,
          data: ReasonPhrases.BAD_REQUEST,
        });
        break;
      case ErrorCategory.NOT_FOUND:
        request.response = generateErrorResponse({
          status: StatusCodes.NOT_FOUND,
          data: ReasonPhrases.NOT_FOUND,
        });
        break;
      case ErrorCategory.INTERNAL:
      default:
        request.response = generateErrorResponse({
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          data: ReasonPhrases.INTERNAL_SERVER_ERROR,
        });
        break;
    }
  },
});

/**
 * Helper code to determine which error category the error falls into
 */
enum ErrorCategory {
  BAD_REQUEST = 'BAD_REQUEST_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL = 'UNKNOWN_ERROR',
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function getErrorCategory(error: any): ErrorCategory {
  if (
    error instanceof ParseError ||
    error.name === 'UnsupportedMediaTypeError' ||
    error.name === 'ZodError' ||
    error.name === 'MissingUserIdError' ||
    error.name === 'MissingBodyError'
  ) {
    return ErrorCategory.BAD_REQUEST;
  }

  if (
    error.name === 'ResourceNotFoundError' ||
    error.message.includes('404') ||
    error.message.includes('Not Found')
  ) {
    return ErrorCategory.NOT_FOUND;
  }

  return ErrorCategory.INTERNAL;
}
