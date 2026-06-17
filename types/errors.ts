/**
 * @fileoverview Custom error types and type guards for better error handling
 */

/**
 * Node.js system error with code property
 */
export interface NodeError extends Error {
  code?: string;
  errno?: number;
  syscall?: string;
  path?: string;
}

/**
 * MySQL database error
 */
export interface MySQLError extends Error {
  code?: string;
  errno?: number;
  sqlState?: string;
  sqlMessage?: string;
  sql?: string;
}

/**
 * Zod validation error
 */
export interface ZodValidationError extends Error {
  name: 'ZodError';
  issues: Array<{
    path: (string | number)[];
    message: string;
    code: string;
  }>;
}

/**
 * Type guard for Node.js errors with code property
 */
export function isNodeError(error: unknown): error is NodeError {
  return error instanceof Error && 'code' in error;
}

/**
 * Type guard for MySQL errors
 */
export function isMySQLError(error: unknown): error is MySQLError {
  return (
    error instanceof Error &&
    'errno' in error &&
    ('sqlState' in error || 'code' in error)
  );
}

/**
 * Type guard for Zod validation errors
 */
export function isZodError(error: unknown): error is ZodValidationError {
  return (
    error instanceof Error &&
    error.name === 'ZodError' &&
    'issues' in error
  );
}

/**
 * Safely format any error to string
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

/**
 * Extract error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return String(error);
}
