import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * Pagination, sorting and filtering.
 *
 * `MAX_LIMIT` is not advisory. A public endpoint that accepts an unbounded
 * `limit` is a denial-of-service primitive anyone can fire with a URL, so the
 * ceiling is enforced by the schema rather than left to a caller's good manners.
 */
export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 20;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  /** `-field` for descending, matching the documented API convention. */
  sort: z
    .string()
    .regex(/^-?[a-zA-Z][a-zA-Z0-9_]*$/, 'Invalid sort field')
    .optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Swagger documentation for the shared query parameters. */
export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'Page number, 1-indexed' })
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_LIMIT,
    default: DEFAULT_LIMIT,
    description: `Items per page. Capped at ${MAX_LIMIT}.`,
  })
  limit?: number;

  @ApiPropertyOptional({
    description: 'Sort field. Prefix with `-` for descending, e.g. `-createdAt`.',
    example: '-createdAt',
  })
  sort?: string;

  @ApiPropertyOptional({ description: 'Free-text search' })
  q?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

export function buildPagination(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

export function paginate<T>(
  items: T[],
  page: number,
  limit: number,
  total: number,
): PaginatedResult<T> {
  return { items, pagination: buildPagination(page, limit, total) };
}

/** Offset for a 1-indexed page. */
export function offsetFor(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Resolve a client-supplied sort field against an ALLOW-LIST.
 *
 * Never interpolate a column name from a request into SQL. The allow-list is
 * the boundary: anything not in it falls back to the default, which means a
 * caller cannot probe the schema by guessing column names either.
 */
export function resolveSort<TColumns extends Record<string, unknown>>(
  sort: string | undefined,
  allowed: TColumns,
  fallback: keyof TColumns,
): { column: TColumns[keyof TColumns]; direction: 'asc' | 'desc' } {
  const descending = sort?.startsWith('-') ?? false;
  const field = sort?.replace(/^-/, '');

  const key = field && field in allowed ? (field as keyof TColumns) : fallback;

  return { column: allowed[key], direction: descending ? 'desc' : 'asc' };
}
