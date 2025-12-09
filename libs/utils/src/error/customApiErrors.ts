export class ResourceNotFoundError extends Error {
  name = 'ResourceNotFoundError';
  constructor(message?: string) {
    super(message || 'The requested resource was not found.');
  }
}

export class MissingUserIdError extends Error {
  name = 'MissingUserIdError';
  constructor(message?: string) {
    super(message || 'User ID is required in the path.');
  }
}

export class MissingBodyError extends Error {
  name = 'MissingBodyError';
  constructor(message?: string) {
    super(message || 'Request body is required.');
  }
}
