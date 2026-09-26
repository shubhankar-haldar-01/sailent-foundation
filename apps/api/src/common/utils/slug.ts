/**
 * Slug generation.
 *
 * Used when creating content server-side. Slug HISTORY matters — Phase 0
 * requires a changed slug to 301-redirect from the old one — so a slug is
 * generated once and then treated as stable rather than recomputed from the
 * title on every save.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

/** Append a numeric suffix until the slug is unique within `existing`. */
export function uniqueSlug(base: string, existing: Set<string>): string {
  const slug = slugify(base);
  if (!existing.has(slug)) return slug;

  let suffix = 2;
  while (existing.has(`${slug}-${suffix}`)) suffix += 1;
  return `${slug}-${suffix}`;
}
