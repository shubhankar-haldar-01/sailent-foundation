import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AdminMedia } from '@/lib/admin/api';

/**
 * Neither cover-image picker may offer an image that cannot be shown.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE BUG THIS PINS: a grid of broken-image icons.
 *
 * `media.url` is NULL for a private image by database constraint, and also for
 * the seeded demo rows — `demo/campaigns/<slug>/N.jpg` keys with no object
 * behind them. The Success Stories picker mapped those to `item.url ?? ''` and
 * rendered `<img src="">`, which a browser resolves against the current page.
 * The result was a picker full of broken images announcing "Demo photograph 3
 * from the tailoring-training-centre campaign".
 *
 * An unusable entry is not a choice: the API refuses a cover image with no
 * public URL, so offering one shows an editor an option the server rejects.
 *
 * Asserted on the rendered DOM rather than on props, because `src=""` is a
 * rendering fault — a component can hold a perfectly sensible object and still
 * emit an image element with nowhere to point.
 * ══════════════════════════════════════════════════════════════════════════
 */

// `story-form` pulls in server actions and the router; neither is the subject.
vi.mock('@/lib/admin/actions', () => ({
  createStory: vi.fn(),
  updateStory: vi.fn(),
  setStoryStatus: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { MediaPicker } = await import('../media-picker');
const { StoryForm } = await import('../story-form');

const base = {
  storageKey: 'x',
  caption: null,
  mimeType: 'image/jpeg',
  sizeBytes: 1024,
  width: 1600,
  height: 1200,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/** A seeded demo row: public, but with no object and therefore no URL. */
const DEMO_WITHOUT_URL: AdminMedia = {
  ...base,
  id: 'demo-1',
  storageKey: 'demo/campaigns/tailoring-training-centre/3.jpg',
  url: null,
  altText: 'Demo photograph 3 from the tailoring-training-centre campaign',
  visibility: 'public',
};

/** A private image. `url` is NULL by database constraint. */
const PRIVATE_WITHOUT_URL: AdminMedia = {
  ...base,
  id: 'private-1',
  url: null,
  altText: 'A private document scan',
  visibility: 'private',
};

const USABLE: AdminMedia = {
  ...base,
  id: 'usable-1',
  url: 'https://pub-example.r2.dev/media/2026/01/abc.jpg',
  altText: 'A real classroom photograph',
  visibility: 'public',
};

/** Every image element that would request nothing, or request this page. */
function emptySourceImages(container: HTMLElement): HTMLImageElement[] {
  return [...container.querySelectorAll('img')].filter((image) => {
    const src = image.getAttribute('src');
    return src === null || src.trim() === '';
  });
}

describe.each([
  [
    'the shared MediaPicker (blog)',
    (options: AdminMedia[]) =>
      render(<MediaPicker options={options} selectedId={null} onSelect={() => {}} />),
  ],
  [
    'the Success Stories cover picker',
    (options: AdminMedia[]) => render(<StoryForm mediaOptions={options} />),
  ],
])('%s', (_label, renderPicker) => {
  it('never renders an image with an empty source', () => {
    const { container } = renderPicker([DEMO_WITHOUT_URL, PRIVATE_WITHOUT_URL, USABLE]);
    expect(emptySourceImages(container)).toHaveLength(0);
  });

  it('does not offer a demo record that has no object behind it', () => {
    renderPicker([DEMO_WITHOUT_URL, USABLE]);
    expect(screen.queryByAltText(DEMO_WITHOUT_URL.altText)).toBeNull();
  });

  it('does not offer a private image, which can have no public URL', () => {
    renderPicker([PRIVATE_WITHOUT_URL, USABLE]);
    expect(screen.queryByAltText(PRIVATE_WITHOUT_URL.altText)).toBeNull();
  });

  it('still offers an image that does resolve', () => {
    renderPicker([DEMO_WITHOUT_URL, PRIVATE_WITHOUT_URL, USABLE]);
    const image = screen.getByAltText(USABLE.altText);
    expect(image).toHaveAttribute('src', USABLE.url!);
  });

  it('says so plainly when nothing in the library can be used', () => {
    /*
      The state the demo rows actually produce on a fresh database: fifteen
      media records, none of them usable. "No images in the library yet" would
      be wrong — there are fifteen — so both pickers say nothing is USABLE and
      link to the library.
    */
    renderPicker([DEMO_WITHOUT_URL, PRIVATE_WITHOUT_URL]);
    expect(screen.getByText(/no (usable )?(public )?images in the library yet/i)).toBeVisible();
    expect(screen.getByRole('link', { name: /upload one/i })).toBeVisible();
  });
});
