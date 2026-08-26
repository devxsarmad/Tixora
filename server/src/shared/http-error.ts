// Usage:
// Defines a small typed error object for expected API failures such as invalid
// credentials, duplicate emails, and validation errors.

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code = 'HTTP_ERROR'
  ) {
    super(message);
  }
}
