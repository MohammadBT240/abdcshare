/** Stable error codes shared across the API error envelope and the web client. */
export const ERROR_CODE = {
  Validation: 'VALIDATION',
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  Internal: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

export interface ApiErrorBody {
  error: string;
  code: ErrorCode;
  fieldErrors?: Record<string, string>;
}
