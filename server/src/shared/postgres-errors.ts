// Usage:
// Keeps Postgres error-code checks in one place so services can translate
// database failures into stable HTTP errors.

export const POSTGRES_UNIQUE_VIOLATION = '23505';

export function isPostgresError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}
