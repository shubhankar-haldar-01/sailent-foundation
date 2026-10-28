'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import type { MediaRef } from '@/lib/mock/types';

/**
 * Parses a video URL (YouTube, Vimeo, or direct MP4/video link) into an embeddable format.
 */
export function getVideoEmbedUrl(url: string | null | undefined): {
  type: 'youtube' | 'vimeo' | 'direct';
  embedUrl: string;
} | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // YouTube match: regular watch URL, youtu.be, embed, shorts
  const ytMatch = trimmed.match(
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i,
  );
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`,
    };
  }

  // Vimeo match: vimeo.com/123456789
  const vimeoMatch = trimmed.match(/(?:vimeo\.com\/)(\d+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?dnt=1`,
    };
  }

  // Direct video or other source
  return {
    type: 'direct',
    embedUrl: trimmed,
  };
}

/**
 * The campaign's gallery photographs and video — one at a time, with an arrow on each side.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * AT THE TOP OF "ABOUT THIS CAMPAIGN".
 *
 * It sits between the About heading and the text cards, so the reader sees
 * the work (images & video) before reading about it. The arrows step through
 * the campaign's gallery slides and a counter says where they are.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function CampaignGallery({
  images,
  title,
  videoUrl,
}: {
  images: MediaRef[];
  title: string;
  videoUrl?: string | null;
}) {
  const railRef = React.useRef<HTMLUListElement>(null);
  const [active, setActive] = React.useState(0);

  const video = React.useMemo(() => getVideoEmbedUrl(videoUrl), [videoUrl]);
  const totalSlides = (video ? 1 : 0) + images.length;

  const onScroll = React.useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const index = Math.round(rail.scrollLeft / Math.max(rail.clientWidth, 1));
    setActive(Math.min(Math.max(index, 0), Math.max(totalSlides - 1, 0)));
  }, [totalSlides]);

  const show = (index: number) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollTo({ left: index * rail.clientWidth, behavior: 'smooth' });
    setActive(index);
  };

  if (totalSlides === 0) return null;

  const hasMany = totalSlides > 1;

  return (
    <figure className="mt-4">
      <div className="border-border/70 bg-muted relative aspect-[16/10] overflow-hidden rounded-2xl border shadow-sm md:aspect-[2/1]">
        <ul
          ref={railRef}
          onScroll={onScroll}
          tabIndex={0}
          aria-label={`${title} — gallery`}
          // `rail` hides the scrollbar without disabling the scrolling.
          className="rail focus-visible:outline-ring absolute inset-0 flex snap-x snap-mandatory overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-4"
        >
          {video ? (
            <li
              key="campaign-video"
              className="relative h-full w-full shrink-0 basis-full snap-start bg-black"
            >
              {video.type === 'direct' ? (
                <video
                  src={video.embedUrl}
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                />
              ) : (
                <iframe
                  src={video.embedUrl}
                  title={`${title} — video presentation`}
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </li>
          ) : null}

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
              label="Previous slide"
              disabled={active === 0}
              onClick={() => show(active - 1)}
            />
            <Arrow
              side="right"
              label="Next slide"
              disabled={active === totalSlides - 1}
              onClick={() => show(active + 1)}
            />
            <span
              data-numeric=""
              className="text-caption backdrop-blur-xs absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 font-semibold text-white"
            >
              <span className="sr-only">Slide </span>
              {active + 1} / {totalSlides}
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
