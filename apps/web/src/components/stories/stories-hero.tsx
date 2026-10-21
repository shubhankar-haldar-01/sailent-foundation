import { BookOpen, Heart, Users, type LucideIcon } from 'lucide-react';

import { cn } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { headingExtraBold } from '@/lib/fonts';

/**
 * The Stories page's opening band, matched to the owner's design (2026-10-14):
 * one cream, rounded card. On the left the eyebrow, the two-line headline
 * ("Real people." navy, "Real change." orange), the lead, three highlights on
 * soft discs; on the right one photograph
 * with rounded corners, set almost to the card's edge.
 *
 * ON A PHONE IT IS NOT THE DESKTOP SHRUNK: eyebrow, headline and lead, then
 * the photograph full-width at 4:3, then the highlights as rows — the order
 * the design's phone panel draws. The source order IS
 * that phone order; from `lg` the grid places the photograph in the right
 * column across the text column's rows.
 *
 * The breadcrumb is not shown (owner, 2026-10-15) but stays in the card for
 * screen readers and as the page's one BreadcrumbList.
 *
 * The photograph is illustrative — the pupils in it are not the subjects of
 * the stories below — so its alt text says what it shows, no more.
 */
const HIGHLIGHTS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Users, title: 'Real people', text: 'Lives and voices from our communities.' },
  {
    icon: BookOpen,
    title: 'Stories from the ground',
    text: 'Real experiences and lasting impact.',
  },
  { icon: Heart, title: 'Hope that inspires change', text: 'Brighter futures through our work.' },
];

export function StoriesHero() {
  return (
    <section aria-labelledby="stories-title" className="pt-4 sm:pt-6 lg:pt-8">
      <div className="container-page">
        <div
          className={cn(
            'bg-surface-warm rounded-[1.25rem] px-6 pb-8 pt-10 sm:rounded-[1.75rem] sm:px-10 sm:pb-10 sm:pt-12',
            // The photograph takes 44% of the card, as the design proportions it; the text the rest.
            'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,44%)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-4 lg:py-16 lg:pl-16 lg:pr-2',
          )}
        >
          <div className="lg:col-start-1 lg:row-start-1">
            <p className="text-primary flex items-center gap-5 text-sm font-semibold uppercase leading-6 tracking-[0.24em]">
              <span aria-hidden="true" className="bg-cta-bright h-0.5 w-12 shrink-0 rounded-full" />
              Stories
            </p>
            <h1
              id="stories-title"
              className={cn(
                headingExtraBold.className,
                'text-foreground mt-5 text-[clamp(2.25rem,0.5rem+4.4vw,4.375rem)] leading-[1.1] tracking-[-0.025em]',
              )}
            >
              <span className="block">Real people.</span>
              {/* Display size only: the bright orange is for large text (`--cta-bright`). */}
              <span className="text-cta-bright block">Real change.</span>
            </h1>
            <p className="text-foreground/75 mt-5 max-w-[38rem] text-[1.0625rem] leading-[1.5] sm:text-lg lg:mt-6 lg:text-xl xl:text-[1.375rem]">
              Stories from children, families and communities whose lives are changing through our
              long-term work.
            </p>
          </div>

          {/* 4:3 and full-width on a phone; from `lg`, the right column, as tall as its 8:7 shape. */}
          <MediaFrame
            media={{
              seed: 'campaigns-hero-education',
              alt: 'A schoolgirl in uniform smiling, a book in her arms and her classmates behind her',
              url: '/images/campaigns-hero-education.webp',
            }}
            aspect="photo"
            rounded={false}
            priority
            focus="left center"
            className="mt-5 rounded-[0.875rem] sm:mt-7 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:aspect-[8/7] lg:rounded-[1.125rem]"
            sizes="(max-width: 64rem) 100vw, 36rem"
          />

          {/* Three across where the row has room (a tablet, and the full desktop column from 1408px); rows between, where the text column beside the photograph is narrow. */}
          <ul className="min-[88rem]:grid-cols-3 min-[88rem]:gap-x-2.5 mt-4 grid gap-y-3.5 sm:mt-8 md:grid-cols-3 md:gap-x-5 lg:col-start-1 lg:row-start-2 lg:mt-11 lg:max-w-[44rem] lg:grid-cols-1 lg:gap-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-center gap-3.5">
                <span
                  aria-hidden="true"
                  className="bg-wash-coral text-cta-glow grid size-14 shrink-0 place-items-center rounded-full lg:size-[4.5rem]"
                >
                  <Icon className="size-6 lg:size-7" strokeWidth={1.75} />
                </span>
                <span className="min-w-0">
                  <span className="font-display text-foreground block text-base font-bold leading-[1.25] lg:text-[1.0625rem]">
                    {title}
                  </span>
                  <span className="text-foreground/70 mt-1 block text-[0.8125rem] leading-[1.4]">
                    {text}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {/* Not shown (owner, 2026-10-15); kept for screen readers and as BreadcrumbList data. */}
          <div className="sr-only">
            <Breadcrumbs
              entries={[
                { name: 'Home', path: '/' },
                { name: 'Stories', path: '/stories' },
              ]}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
