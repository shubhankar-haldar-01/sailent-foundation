import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@sailent/ui';

import { PageShell } from '@/components/layout/page-shell';

/**
 * The programs page hero section, matched 100% to the owner's design.
 *
 * Left: Eyebrow ("OUR PROGRAMS"), two-tone heading ("Long-term work, not one-off projects"),
 * description paragraph, and action buttons ("Donate Now →" and "Explore Our Programs →").
 * Right: Large rounded photograph with high-contrast shadow.
 * Bottom: Smooth wave transition into the programs listing section.
 */
export function ProgramsHero() {
  return (
    <section
      aria-labelledby="programs-title"
      className="relative overflow-hidden bg-gradient-to-b from-[#F2F8FD] via-[#EEF6FC] to-[#E6F1FA] pb-16 pt-12 md:pb-20 md:pt-16 lg:pb-24 lg:pt-20 dark:from-[#0B1B2B] dark:via-[#0E2235] dark:to-[#0A1724]"
    >
      <PageShell className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14 xl:gap-16">
        <div className="max-w-xl">
          <div className="flex items-center gap-3">
            <span className="text-primary text-xs font-bold uppercase tracking-[0.2em] sm:text-sm">
              OUR PROGRAMS
            </span>
            <span className="h-[1.5px] w-8 bg-[#EB6A1F]" aria-hidden="true" />
          </div>

          <h1
            id="programs-title"
            className="font-display mt-3 text-balance text-3xl font-bold leading-[1.15] tracking-tight text-[#102A43] sm:text-4xl lg:text-[2.45rem] xl:text-[2.75rem] dark:text-white"
          >
            <span className="block">Long-term work,</span>
            <span className="text-primary block">
              not <span className="whitespace-nowrap">one-off</span> projects.
            </span>
          </h1>

          <p className="mt-5 text-base leading-[1.65] text-[#486581] sm:text-[1.0625rem] lg:text-[1.125rem] dark:text-slate-300">
            Our programs run for years and are measured over time. Campaigns fund specific pieces of
            them, which is why a campaign always belongs to a program.
          </p>

          <div className="mt-7 flex flex-col gap-3.5 sm:mt-8 sm:flex-row sm:items-center sm:gap-4">
            <Button
              asChild
              size="lg"
              className="text-primary-foreground hover:bg-primary-hover h-12 w-full rounded-full bg-[#EB6A1F] px-7 text-base font-semibold shadow-md shadow-[#EB6A1F]/25 transition-all duration-200 hover:shadow-lg hover:shadow-[#EB6A1F]/35 sm:w-auto sm:px-8"
            >
              <Link
                href="/donate"
                className="inline-flex w-full items-center justify-center gap-2 sm:w-auto"
              >
                Donate Now
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="h-12 w-full rounded-full border-2 border-[#0070BA] bg-white px-7 text-base font-semibold text-[#0070BA] shadow-none transition-all duration-200 hover:bg-[#0070BA]/5 sm:w-auto sm:px-8 dark:border-sky-400 dark:bg-slate-900 dark:text-sky-400 dark:hover:bg-sky-400/10"
            >
              <Link
                href="#programs-list"
                className="inline-flex w-full items-center justify-center gap-2 sm:w-auto"
              >
                Explore Our Programs
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[34rem] lg:max-w-none">
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[24px] shadow-xl shadow-[#102A43]/10 ring-1 ring-black/5 sm:rounded-[32px] dark:ring-white/10">
            <Image
              src="/images/programs-hero.webp"
              alt="Sailent Foundation community development programs in action across healthcare, education, and livelihoods"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, (max-width: 1280px) 50vw, 600px"
              className="object-cover object-center"
            />
          </div>
        </div>
      </PageShell>

      {/* Gentle curved wave at bottom */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 w-full overflow-hidden leading-none">
        <svg
          viewBox="0 0 1440 96"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-background h-8 w-full sm:h-12 lg:h-16"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0,40 C360,95 840,15 1440,55 L1440,96 L0,96 Z" fill="currentColor" />
        </svg>
      </div>
    </section>
  );
}
