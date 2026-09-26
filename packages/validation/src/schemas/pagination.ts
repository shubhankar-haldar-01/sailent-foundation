import { z } from 'zod';

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  perPage: z.coerce.number().int().min(1).max(MAX_PER_PAGE).default(DEFAULT_PER_PAGE),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

/** `?sort=-createdAt` — a leading `-` means descending. */
export const sortSchema = z
  .string()
  .regex(/^-?[a-zA-Z][a-zA-Z0-9_]*$/, 'Invalid sort field')
  .transform((value) => ({
    field: value.startsWith('-') ? value.slice(1) : value,
    direction: value.startsWith('-') ? ('desc' as const) : ('asc' as const),
  }));

export const cursorSchema = z.object({
  cursor: z.string().max(4096).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PER_PAGE).default(DEFAULT_PER_PAGE),
});
