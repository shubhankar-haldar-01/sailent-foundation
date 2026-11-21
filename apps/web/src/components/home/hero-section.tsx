import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Button, formatNumber } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import { PageShell } from '@/components/layout/page-shell';
import type { ImpactMetric } from '@/lib/content';
import { localMedia, publicAssetExists } from '@/lib/media/public-asset';

/**
 * Supplied hero banner creatives for desktop and mobile viewports.
 *
 * Resolved at module load via `publicAssetExists`. If unavailable, falls back
 * to a deterministic placeholder.
 */
const HERO_PHOTO_DESKTOP = '/images/hero-banner-desktop.webp';
const HERO_PHOTO_MOBILE = '/images/hero-banner-mobile.webp';

const hasHeroDesktop = publicAssetExists(HERO_PHOTO_DESKTOP);
const hasHeroMobile = publicAssetExists(HERO_PHOTO_MOBILE);

/**
 * Homepage hero: the photograph beside one clear message and one main action
 * (visual polish Phase 4, owner 2026-11-21).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE HEADLINE IS LIVE TEXT NOW.
 *
 * The supplied banners have the headline drawn into the picture (orange
 * words on a navy wash), so it could not follow the type, the colours, dark
 * mode or a translation. There is no clean version of the photograph, so the
 * frame CROPS to the photograph's side of the banner (`object-left` in a
 * narrower frame) and the words are set beside it in Inter: the headline, one
 * supporting line, and one orange "Donate now" — the page's single primary
 * call to action (§11 item 12). On a phone the photograph sits above them.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function HeroSection({ metrics }: { metrics: ImpactMetric[] }) {
  // Live aggregate "beneficiaries reached" metric for social proof.
  const reached = metrics.find((metric) => metric.id === 'beneficiaries');
  const photo = hasHeroDesktop ? HERO_PHOTO_DESKTOP : hasHeroMobile ? HERO_PHOTO_MOBILE : null;

  return (
    <section aria-labelledby="hero-title" className="relative pt-4 sm:pt-6">
      <PageShell>
        <div className="border-border bg-surface grid overflow-hidden rounded-2xl border md:grid-cols-2">
          {/* The photograph, cropped to its own side of the banner. */}
          {/*
            4:3 at every width: the banner is about 2.2:1 with its baked
            headline in the right third, so a 4:3 frame cropped from the left
            shows only the photograph.
          */}
          <div className="relative aspect-[4/3]">
            {photo ? (
              <Image
                src={photo}
                alt=""
                fill
                priority
                fetchPriority="high"
                sizes="(max-width: 767px) 100vw, 50vw"
                className="object-cover object-left"
              />
            ) : (
              <MediaFrame
                media={{ seed: 'home-hero', alt: '' }}
                aspect="photo"
                rounded={false}
                priority
                className="size-full [&>svg]:size-full"
              />
            )}
          </div>

          <div className="flex flex-col justify-center gap-5 p-6 sm:p-8 lg:p-12">
            <p className="text-overline tracking-(--text-overline--letter-spacing) text-primary font-semibold uppercase">
              Sailent Foundation
            </p>
            <h1
              id="hero-title"
              className="text-display-hero tracking-(--text-display-hero--letter-spacing) text-foreground text-balance font-semibold"
            >
              Every child deserves a brighter future
            </h1>
            <p className="text-body-lg text-muted-foreground max-w-md leading-relaxed">
              Together, we can create safer spaces to learn, grow and thrive.
            </p>
            <div>
              <Button asChild variant="action" size="lg">
                <Link href="/donate">
                  Donate now
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </PageShell>

      {/* Live Impact Ticker Bar */}
      {reached ? (
        <aside
          aria-label="Impact summary"
          className="border-border bg-surface shadow-xs relative z-10 mt-4 border-y py-2.5 sm:mt-6 sm:py-3"
        >
          <PageShell>
            <div className="flex items-center justify-center gap-2 sm:justify-start sm:gap-3">
              <ul aria-hidden="true" className="flex shrink-0 -space-x-2 sm:-space-x-2">
                {['a', 'b', 'c', 'd'].map((seed) => (
                  <li
                    key={seed}
                    className="border-surface size-6.5 shadow-xs sm:size-7.5 overflow-hidden rounded-full border-2"
                  >
                    <MediaFrame
                      media={localMedia(`team-supporter-${seed}`, '')}
                      aspect="square"
                      rounded={false}
                      sizes="30px"
                    />
                  </li>
                ))}
              </ul>
              {/*
                One line from 360px up. Below that (WCAG reflow requires 320px)
                the four avatars and the sentence do not fit side by side, so
                the sentence may wrap rather than push the page sideways.
              */}
              <p className="text-foreground sm:text-body-sm min-w-0 whitespace-nowrap text-xs font-medium max-[359px]:whitespace-normal max-[359px]:leading-snug">
                <span data-numeric="" className="text-primary font-bold tabular-nums">
                  {formatNumber(reached.value)}
                </span>{' '}
                <span className="text-muted-foreground">lives already impacted across India</span>
              </p>
            </div>
          </PageShell>
        </aside>
      ) : null}
    </section>
  );
}
