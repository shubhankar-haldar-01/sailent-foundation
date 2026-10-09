import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Button } from '@sailent/ui';

import { LeafSpray, Rays } from '@/components/about/decor';
import { PageShell } from '@/components/layout/page-shell';
import { MediaFrame } from '@/components/media/media-frame';
import { localMedia } from '@/lib/media/public-asset';

import { BlueLeaves } from './decor';

/**
 * "Support our programs" — the closing ask on the programs page, matched to
 * the owner's design (2026-10-08): a warm panel with the ask on the left and
 * two overlapping photographs on the right, leaves tucked behind them.
 *
 * One action, the general donation. On a phone the photographs follow the
 * ask rather than sitting beside it.
 */
export function SupportPrograms() {
  const together = localMedia(
    'about-presence-walk',
    'Three schoolchildren walking together, arms round each other’s shoulders',
  );
  const planting = localMedia('campaign-greener-communities-bhopal', 'Hands planting a seedling');

  return (
    <section aria-labelledby="support-programs-title" className="pb-16 md:pb-20 lg:pb-24">
      <PageShell>
        <div className="bg-primary-soft relative overflow-hidden rounded-[1.75rem] px-6 pb-8 pt-10 sm:px-10 sm:pb-10 md:pt-12 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:items-center lg:gap-10 lg:px-14 lg:py-8 xl:px-[4.5rem]">
          <div className="relative">
            <Rays className="text-cta-glow absolute -left-1 -top-7 h-12 w-9 sm:-left-12 sm:-top-4 sm:h-14 sm:w-10" />
            <p className="text-primary pl-9 text-[0.8125rem] font-bold uppercase tracking-[0.08em] sm:pl-0 sm:text-[0.875rem]">
              Be part of the change
            </p>
            <h2
              id="support-programs-title"
              className="font-display text-foreground mt-2 text-[clamp(1.875rem,1.2rem+2vw,2.875rem)] font-bold leading-tight tracking-[-0.02em]"
            >
              Support our programs
            </h2>
            <p className="text-muted-foreground mt-4 max-w-[34rem] text-[1rem] leading-relaxed sm:text-[1.0625rem]">
              Every donation helps sustain the long-term work behind each program — not just a
              single campaign.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-7 h-14 rounded-full px-10 text-[1.0625rem] max-sm:w-full sm:min-w-[15rem] lg:h-16 lg:min-w-[20rem] lg:text-lg"
            >
              <Link href="/donate">
                Donate Now
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>

          {/* Two photographs, overlapping and slightly turned, with leaves behind. */}
          <div className="relative mx-auto mt-10 aspect-[460/300] w-full max-w-[29rem] lg:mt-0 lg:aspect-[540/310] lg:max-w-none">
            <LeafSpray className="absolute -left-[3%] bottom-[2%] h-[62%] w-auto opacity-90" />
            <BlueLeaves className="absolute -top-[3%] right-[2%] h-[34%] w-auto" />
            <span
              aria-hidden="true"
              className="bg-primary/15 absolute right-0 top-[38%] size-[9%] rounded-full"
            />
            <div className="bg-surface absolute left-[8%] top-[6%] w-[70%] -rotate-[4deg] rounded-2xl p-1.5 shadow-[0_18px_36px_-20px_rgb(15_23_42/0.45)]">
              <MediaFrame
                media={together}
                aspect="landscape"
                className="rounded-xl"
                sizes="(max-width: 1024px) 70vw, 340px"
              />
            </div>
            <div className="bg-surface absolute bottom-[3%] right-[4%] w-[36%] rotate-[5deg] rounded-2xl p-1.5 shadow-[0_18px_36px_-20px_rgb(15_23_42/0.45)]">
              <MediaFrame
                media={planting}
                aspect="square"
                focus="45% center"
                className="rounded-xl"
                sizes="(max-width: 1024px) 40vw, 180px"
              />
            </div>
          </div>
        </div>
      </PageShell>
    </section>
  );
}
