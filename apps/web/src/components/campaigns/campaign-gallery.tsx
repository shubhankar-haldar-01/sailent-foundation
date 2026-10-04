'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import type { MediaRef } from '@/lib/mock/types';

/**
 * The campaign's photographs — one at a time, with an arrow on each side.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONE PHOTOGRAPH, AT THE TOP OF "ABOUT THIS CAMPAIGN".
 *
 * It sits between the About heading and the text cards, so the reader sees
 * the work before reading about it. The arrows step through the campaign's
 * gallery and a counter says where they are. No caption is shown under the
 * photo; each one's description is its alt text, for screen readers.
 *
 * A SCROLL CONTAINER, NOT A TRANSFORM. Slides sit in a `scroll-snap` row, so
 * swiping works before JavaScript arrives and the browser does the
 * animation; the arrows only scroll that row, and the photo shown is read back
 * from its position, so a swipe and an arrow never disagree. The row itself is
 * focusable — axe requires a keyboard way into any region that scrolls — and
 * the arrow keys then scroll it natively.
 *
 * THE PICTURES ARE THE CAMPAIGN'S, from the media library through
 * `campaign_gallery`; the frame draws its placeholder only where no file has
 * been uploaded yet. No autoplay: nothing moves unless somebody asks.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function CampaignGallery({ images, title }: { images: MediaRef[]; title: string }) {
  const railRef = React.useRef<HTMLUListElement>(null);
  const [active, setActive] = React.useState(0);

  const onScroll = React.useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const index = Math.round(rail.scrollLeft / Math.max(rail.clientWidth, 1));
    setActive(Math.min(Math.max(index, 0), Math.max(images.length - 1, 0)));
  }, [images.length]);

  const show = (index: number) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollTo({ left: index * rail.clientWidth, behavior: 'smooth' });
    setActive(index);
  };

  if (images.length === 0) return null;

  const hasMany = images.length > 1;

  return (
    <figure className="mt-4">
      <div className="border-border/70 bg-muted relative aspect-[16/10] overflow-hidden rounded-2xl border shadow-sm md:aspect-[2/1]">
        <ul
          ref={railRef}
          onScroll={onScroll}
          tabIndex={0}
          aria-label={`${title} — photos`}
          // `rail` hides the scrollbar without disabling the scrolling.
          className="rail focus-visible:outline-ring absolute inset-0 flex snap-x snap-mandatory overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-4"
        >
          {images.map((image, index) => (
            <li
              key={`${image.seed}-${index}`}
              className="relative h-full w-full shrink-0 basis-full snap-start"
            >
              <MediaFrame
                media={image}
                aspect="wide"
                rounded={false}
                className="aspect-auto h-full"
                sizes="(max-width: 1024px) 100vw, 944px"
              />
            </li>
          ))}
        </ul>

        {hasMany ? (
          <>
            <Arrow
              side="left"
              label="Previous photo"
              disabled={active === 0}
              onClick={() => show(active - 1)}
            />
            <Arrow
              side="right"
              label="Next photo"
              disabled={active === images.length - 1}
              onClick={() => show(active + 1)}
            />
            <span
              data-numeric=""
              className="text-caption absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 font-semibold text-white"
            >
              <span className="sr-only">Photo </span>
              {active + 1} / {images.length}
            </span>
          </>
        ) : null}
      </div>
    </figure>
  );
}

function Arrow({
  side,
  label,
  disabled,
  onClick,
}: {
  side: 'left' | 'right';
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        // 40px over a photograph — above the 24px WCAG 2.5.8 floor.
        'bg-surface/95 text-foreground focus-visible:outline-ring hover:bg-surface absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full shadow-md transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2',
        // Dimmed at the ends, never removed, so the control never jumps.
        'disabled:pointer-events-none disabled:opacity-50',
        side === 'left' ? 'left-3' : 'right-3',
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  );
}
