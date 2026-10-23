import Image from 'next/image';
import Link from 'next/link';

import { formatNumber } from '@sailent/ui';

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
 * Homepage hero banner.
 *
 * Uses dedicated, art-directed creatives for desktop (16:9 widescreen) and mobile (2:3 portrait):
 * - Desktop: Children in classroom on left, dark navy wash with "Every Child Deserves
 *   a Brighter Future" and "Donate Now" CTA on right.
 * - Mobile: Children in classroom on top, dark navy wash with copy and "Donate Now" CTA on bottom.
 *
 * Accessible semantics:
 * - Hidden `<h1>` and copy provides search engines and assistive technology with the headline.
 * - Interactive focus-visible links navigate directly to `/donate`.
 * - Tactile hover highlight positioned precisely over the embedded "Donate Now" CTA pill.
 */
export function HeroSection({ metrics }: { metrics: ImpactMetric[] }) {
  // Live aggregate "beneficiaries reached" metric for social proof.
  const reached = metrics.find((metric) => metric.id === 'beneficiaries');

  return (
    <section aria-labelledby="hero-title" className="relative pt-4 sm:pt-6">
      {/* Screen-reader and SEO accessible semantic content */}
      <div className="sr-only">
        <h1 id="hero-title">Sailent Foundation — Every Child Deserves a Brighter Future</h1>
        <p>Together, we can create safer spaces to learn, grow, and thrive.</p>
        <Link href="/donate">Donate Now</Link>
      </div>

      <PageShell>
        <div className="relative overflow-hidden rounded-[24px] border border-slate-100 bg-[#0B1B2B] shadow-[0_4px_24px_rgba(0,0,0,0.03)] sm:rounded-[32px] dark:border-slate-800">
          {/* Mobile hero banner (< 768px) */}
          <div className="relative block w-full md:hidden">
            {hasHeroMobile ? (
              <Link
                href="/donate"
                aria-label="Every Child Deserves a Brighter Future — Donate Now"
                className="focus-visible:outline-primary group relative block w-full overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <Image
                  src={HERO_PHOTO_MOBILE}
                  alt="Every Child Deserves a Brighter Future — Sailent Foundation"
                  width={1671}
                  height={941}
                  priority
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="h-auto w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.01]"
                />
              </Link>
            ) : (
              <MediaFrame
                media={{ seed: 'home-hero-mobile', alt: 'Every Child Deserves a Brighter Future' }}
                aspect="wide"
                rounded={false}
                priority
                className="size-full [&>svg]:size-full"
              />
            )}
          </div>

          {/* Desktop hero banner (>= 768px) */}
          <div className="relative hidden w-full md:block">
            {hasHeroDesktop ? (
              <Link
                href="/donate"
                aria-label="Every Child Deserves a Brighter Future — Donate Now"
                className="focus-visible:outline-primary group relative block w-full overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <Image
                  src={HERO_PHOTO_DESKTOP}
                  alt="Every Child Deserves a Brighter Future — Sailent Foundation"
                  width={1671}
                  height={752}
                  priority
                  sizes="(max-width: 1280px) 100vw, 1280px"
                  className="h-auto w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.01]"
                />
              </Link>
            ) : (
              <MediaFrame
                media={{ seed: 'home-hero-desktop', alt: 'Every Child Deserves a Brighter Future' }}
                aspect="wide"
                rounded={false}
                priority
                className="size-full [&>svg]:size-full"
              />
            )}
          </div>
        </div>
      </PageShell>

      {/* Live Impact Ticker Bar */}
      {reached ? (
        <aside
          aria-label="Impact Summary"
          className="border-border bg-surface shadow-xs relative z-10 mt-4 border-y py-2.5 sm:mt-6"
        >
          <PageShell>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-3">
                <ul aria-hidden="true" className="flex -space-x-2">
                  {['a', 'b', 'c', 'd'].map((seed) => (
                    <li
                      key={seed}
                      className="border-surface size-7.5 shadow-xs overflow-hidden rounded-full border-2"
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
                <p className="text-body-sm text-foreground font-medium">
                  <span data-numeric="" className="text-primary font-bold tabular-nums">
                    {formatNumber(reached.value)}
                  </span>{' '}
                  <span className="text-muted-foreground">lives already impacted across India</span>
                </p>
              </div>
            </div>
          </PageShell>
        </aside>
      ) : null}
    </section>
  );
}
