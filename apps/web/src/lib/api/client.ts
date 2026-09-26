import { REQUEST_ID_HEADER } from '@sailent/config';
import { type ApiError, type ApiResponse, API_ERROR_CODE } from '@sailent/types';

/**
 * Typed API client.
 *
 * Deliberately provider-agnostic about authentication: it accepts a token
 * *getter*, so swapping how tokens are obtained in Phase 3 does not touch a
 * single call site.
 *
 * Where this runs matters (decision A1):
 *   • Server components and route handlers call the API directly.
 *   • The BROWSER never does — it calls `/api/bff/*` on the Next.js origin,
 *     and the route handler attaches the token server-side. No access token
 *     ever reaches client-side JavaScript, so an XSS bug does not immediately
 *     become a session-theft bug.
 */

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly requestId: string,
    readonly details?: ApiError['error']['details'],
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  /** Whether retrying could plausibly succeed. */
  get isRetryable(): boolean {
    return this.status >= 500 || this.status === 429;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Returns the bearer token, or null when unauthenticated. Server-side only. */
  getToken?: () => Promise<string | null> | string | null;
  /** Propagates the correlation id from the inbound request. */
  getRequestId?: () => string | undefined;
  defaultTimeoutMs?: number;
}

export interface RequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  timeoutMs?: number;
  /** Next.js fetch cache options for server-side calls. */
  next?: { revalidate?: number | false; tags?: string[] };
}

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, { ...options, body });
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, { ...options, body });
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, { ...options, body });
  }

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }

  private async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const { query, body, timeoutMs, next, headers: extraHeaders, ...rest } = options;

    const url = new URL(path.replace(/^\//, ''), ensureTrailingSlash(this.options.baseUrl));
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers = new Headers(extraHeaders);
    headers.set('Accept', 'application/json');
    if (body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    const token = await this.options.getToken?.();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const requestId = this.options.getRequestId?.();
    if (requestId) {
      headers.set(REQUEST_ID_HEADER, requestId);
    }

    // AbortSignal.timeout rather than a manual controller: a request that hangs
    // forever is worse than one that fails, because it holds a connection.
    const signal = AbortSignal.timeout(timeoutMs ?? this.options.defaultTimeoutMs ?? 15_000);

    let response: Response;
    try {
      response = await fetch(url, {
        ...rest,
        method,
        headers,
        signal,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        ...(next ? { next } : {}),
      });
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'TimeoutError';
      throw new ApiClientError(
        isTimeout ? 'REQUEST_TIMEOUT' : API_ERROR_CODE.SERVICE_UNAVAILABLE,
        isTimeout ? 'The request took too long.' : 'Could not reach the server.',
        503,
        requestId ?? 'unknown',
      );
    }

    const responseRequestId = response.headers.get(REQUEST_ID_HEADER) ?? requestId ?? 'unknown';

    if (response.status === 204) {
      return null as T;
    }

    let payload: ApiResponse<T>;
    try {
      payload = (await response.json()) as ApiResponse<T>;
    } catch {
      throw new ApiClientError(
        API_ERROR_CODE.INTERNAL_ERROR,
        'The server returned an unreadable response.',
        response.status,
        responseRequestId,
      );
    }

    if (!response.ok || payload.success === false) {
      const error = payload.success === false ? payload.error : undefined;
      throw new ApiClientError(
        error?.code ?? API_ERROR_CODE.INTERNAL_ERROR,
        error?.message ?? 'Something went wrong.',
        response.status,
        error?.requestId ?? responseRequestId,
        error?.details,
      );
    }

    return payload.data;
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
