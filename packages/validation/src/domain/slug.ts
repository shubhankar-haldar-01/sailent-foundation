/**
 * Slug generation.
 *
 * docs/seo-strategy.md: "Slugs are descriptive but short" and "Slugs never
 * change silently. A change 301-redirects permanently from the old slug, and
 * slug history is retained in the database."
 *
 * This module does the generation half. The history half lives in the API,
 * because it needs the database — but the two belong to one rule, so the
 * redirect obligation is stated here as well as there.
 */

/** Longer than this and the URL stops being readable, which is the point of a slug. */
export const MAX_SLUG_LENGTH = 80;

/**
 * Turn a title into a URL-safe slug.
 *
 * Deliberately lossy and deliberately simple. The result must survive being
 * typed from a poster, read aloud down a phone, and pasted into a message that
 * turns it into a link — so: lowercase ASCII, digits and single hyphens, and
 * nothing else.
 *
 * Diacritics are decomposed rather than stripped, so "Malnutrición" becomes
 * "malnutricion" instead of "malnutricin". Devanagari and other non-Latin
 * scripts have no ASCII equivalent and drop out entirely; `slugify` returning
 * an empty string is the caller's signal to ask for a slug explicitly rather
 * than to invent one, which is why it can return ''.
 */
export function slugify(input: string): string {
  return (
    input
      .normalize('NFKD')
      // Strip combining marks left behind by the decomposition above.
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      // An apostrophe joins the word either side of it: "children's" → "childrens",
      // not "children-s".
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_SLUG_LENGTH)
      // The slice can land mid-hyphen.
      .replace(/-+$/g, '')
  );
}

/** True when a string is already a well-formed slug. */
export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= MAX_SLUG_LENGTH;
}

/**
 * Find a free slug by appending a counter.
 *
 * `taken` answers "does this slug already exist", and must consider BOTH live
 * slugs and retired ones held in slug history — a slug released by one
 * campaign must not be reused by another while a redirect for it still exists,
 * or the redirect starts pointing at the wrong thing.
 *
 * The suffix is appended after truncating, so the result can never exceed the
 * maximum length.
 */
export async function uniqueSlug(
  base: string,
  taken: (candidate: string) => Promise<boolean>,
  { maxAttempts = 50 }: { maxAttempts?: number } = {},
): Promise<string> {
  const root = slugify(base);
  if (!root) throw new Error('Could not derive a slug. Supply one explicitly.');

  if (!(await taken(root))) return root;

  for (let counter = 2; counter <= maxAttempts; counter += 1) {
    const suffix = `-${counter}`;
    const candidate = `${root.slice(0, MAX_SLUG_LENGTH - suffix.length).replace(/-+$/g, '')}${suffix}`;
    if (!(await taken(candidate))) return candidate;
  }

  throw new Error(`Could not find a free slug for "${base}" after ${maxAttempts} attempts.`);
}
