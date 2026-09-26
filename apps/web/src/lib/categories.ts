/**
 * Matching a category SLUG to a category NAME.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * The focus-area strip knows slugs — `food-support`, `women-empowerment`. A
 * campaign carries the display NAME its category was given — "Food Support",
 * "Women Empowerment". Filtering one by the other needs the two reduced to a
 * comparable form, and this is the only place that happens.
 *
 * Lowercase, and drop everything that is not a letter or a digit. Nothing
 * cleverer, deliberately.
 *
 * `category-icon.tsx` has its own `normalise` which ALSO strips the substring
 * "and", so that "Health & Nutrition" and "Health Nutrition" land together.
 * That is fine for choosing an icon, where a wrong guess costs a wrong picture.
 * It is not fine here: stripping "and" turns "Standard Care" into "Stard Care"
 * and would silently match a category to the wrong one, which costs a donor
 * being shown campaigns they did not ask for. A filter has to be exact.
 *
 * The one case this does not cover is a name using "&" against a slug spelling
 * it "and". No category in the system does, and when one does the fix is to
 * match on the category's own id rather than to make this looser.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function categoryKey(value: string | null | undefined): string {
  if (!value) return '';
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Does this campaign's category correspond to that focus-area slug? */
export function matchesCategory(
  campaignCategory: string | null | undefined,
  focusSlug: string | null | undefined,
): boolean {
  if (!focusSlug) return true;
  const key = categoryKey(campaignCategory);
  return key !== '' && key === categoryKey(focusSlug);
}
