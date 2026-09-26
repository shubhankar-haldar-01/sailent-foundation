'use client';

import Link from 'next/link';

import type { AdminMedia } from '@/lib/admin/api';

/**
 * Choose an image that is already in the media library.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONE PICKER, NOT ONE PER FEATURE.
 *
 * This was a private function inside `story-form.tsx`. The blog needs the same
 * control, and copying it would have produced two components that drift — one
 * of which would eventually grow its own upload button and, with it, a second
 * path to R2 with its own idea of the magic-byte check and the storage key.
 *
 * IT DOES NOT UPLOAD, and must not. Uploading belongs to `/admin/media`
 * (Phase 10.6), which owns validation, the bucket choice and the delete-safety
 * rules. This only ever selects from what is already there, and links to that
 * screen when there is nothing to select.
 *
 * PUBLIC IMAGES ONLY are offered. A private image has no public URL by
 * database constraint, so it would render as a broken image for every visitor
 * — the API refuses one as a featured image, and offering it here would mean
 * showing an editor a choice the server rejects.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Keyed by MEDIA ID rather than by URL. `success_stories.cover_image` is a
 * text URL because it predates the media library; `blog_posts` has a real
 * foreign key, which is what lets the library refuse to delete an image an
 * article is using. Callers that still store a URL pass `valueMode="url"`.
 */
export function MediaPicker({
  options,
  selectedId,
  onSelect,
  label = 'Featured image',
}: {
  options: AdminMedia[];
  selectedId: string | null;
  onSelect: (media: AdminMedia | null) => void;
  label?: string;
}) {
  const usable = options.filter((item) => item.visibility === 'public' && item.url);
  const selected = usable.find((item) => item.id === selectedId) ?? null;

  if (usable.length === 0) {
    return (
      <p className="text-body-sm text-muted-foreground">
        No public images in the library yet.{' '}
        <Link href="/admin/media" className="hover:text-foreground underline">
          Upload one
        </Link>
        , then come back.
      </p>
    );
  }

  return (
    <fieldset>
      <legend className="text-body-sm mb-2 font-medium">{label}</legend>

      {selected ? (
        <div className="mb-3 flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selected.url!}
            alt={selected.altText}
            className="border-border h-20 w-28 rounded-md border object-cover"
          />
          <div className="min-w-0">
            <p className="text-body-sm truncate font-medium">{selected.altText}</p>
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="text-caption text-muted-foreground hover:text-foreground mt-1 underline"
            >
              Remove the featured image
            </button>
          </div>
        </div>
      ) : (
        <p className="text-caption text-muted-foreground mb-2">No image chosen.</p>
      )}

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {usable.map((item) => {
          const isSelected = item.id === selectedId;

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(isSelected ? null : item)}
                aria-pressed={isSelected}
                className={`border-border block w-full overflow-hidden rounded-md border-2 ${
                  isSelected ? 'border-primary' : 'hover:border-border border-transparent'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url!}
                  alt={item.altText}
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                />
                <span className="sr-only">
                  {isSelected ? 'Selected: ' : 'Use '}
                  {item.altText}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-caption text-muted-foreground mt-2">
        <Link href="/admin/media" className="hover:text-foreground underline">
          Manage the full library
        </Link>
      </p>
    </fieldset>
  );
}
