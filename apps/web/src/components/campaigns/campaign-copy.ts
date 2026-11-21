/**
 * Guards against campaign text that is not really content (visual polish
 * Phase 4, 2026-11-21).
 *
 * The admin form's own labels have been saved as a campaign's text: the
 * "mountain" campaign showed "Why This Campaign? (The Story)" as its story AND
 * as what its support provides. A paragraph that is only a form label, or a
 * "what your support provides" that repeats the story word for word, says
 * nothing a donor can use, so the page leaves it out rather than showing it.
 * Nothing is rewritten: text is either shown as written or not shown.
 */

/** The admin campaign form's labels and headings (`components/admin/campaign-form.tsx`). */
const ADMIN_FIELD_LABELS = new Set([
  'why this campaign? (the story)',
  'why this campaign?',
  'the story',
  'what will your support provide?',
  'what your support provides',
  'campaign narrative',
]);

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Empty, or nothing but one of the admin form's labels. */
export function isPlaceholderText(text: string | null | undefined): boolean {
  const value = normalise(text ?? '');
  return value.length === 0 || ADMIN_FIELD_LABELS.has(value);
}

/** The story's paragraphs without the placeholder ones. */
export function cleanStory(story: readonly string[]): string[] {
  return story.filter((paragraph) => !isPlaceholderText(paragraph));
}

/**
 * "What your support provides", or null when it is a placeholder or only
 * repeats the story (the whole of it, or one of its paragraphs).
 */
export function cleanSupportProvides(
  text: string | null | undefined,
  story: readonly string[],
): string | null {
  if (!text || isPlaceholderText(text)) return null;
  const value = normalise(text);
  if (value === normalise(story.join(' '))) return null;
  if (story.some((paragraph) => normalise(paragraph) === value)) return null;
  return text.trim();
}
