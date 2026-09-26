export interface PaginationParams {
  page: number;
  perPage: number;
}

export interface SortParams {
  field: string;
  direction: 'asc' | 'desc';
}

/** Cursor pagination, used where offset degrades: audit logs, donation exports. */
export interface CursorParams {
  cursor?: string;
  limit: number;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
