/**
 * API envelope (docs/api-architecture.md §2).
 *
 * A discriminated union on `success` so clients narrow without inspecting
 * the payload. Errors always carry a stable machine-readable `code` the UI
 * branches on, a human-safe `message`, and the `requestId` that correlates
 * to Sentry and the audit log — the string a donor quotes to support.
 */

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<TData> {
  success: true;
  data: TData;
  meta?: PaginationMeta | Record<string, unknown>;
}

export interface ApiErrorDetail {
  field?: string;
  code: string;
  message?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
    requestId: string;
  };
}

export type ApiResponse<TData> = ApiSuccess<TData> | ApiError;

export function isApiError<TData>(response: ApiResponse<TData>): response is ApiError {
  return response.success === false;
}

/** Stable error codes. The UI branches on these, never on `message`. */
export const API_ERROR_CODE = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  /**
   * The caller HAS the permission but their session is not fresh enough for a
   * sensitive operation. Distinct from FORBIDDEN because the client's response
   * differs: prompt for the password again rather than hide the control.
   */
  REAUTH_REQUIRED: 'REAUTH_REQUIRED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODE)[keyof typeof API_ERROR_CODE];
