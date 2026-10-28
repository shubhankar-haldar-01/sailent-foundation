import Link from 'next/link';
import { ArrowRight, Cog, GraduationCap, Heart, PawPrint, Sprout, Users } from 'lucide-react';

import { cn } from '@sailent/ui';
import { MediaFrame } from '@/components/media/media-frame';
import { PageShell } from '@/components/layout/page-shell';
import { localMedia } from '@/lib/media/public-asset';

/**
 * 6 Impact program focus areas matching the approved design specification.
 */
const IMPACT_PROGRAMS = [
  {
    icon: GraduationCap,
    text: 'Provide access to quality education',
    discClass: 'bg-[#DDEEFB] text-[#0070BA] dark:bg-sky-950/70 dark:text-sky-300',
  },
  {
    icon: Heart,
    text: 'Support healthcare and nutrition',
    discClass: 'bg-[#FEEAE0] text-primary dark:bg-orange-950/70 dark:text-orange-300',
  },
  {
    icon: Sprout,
    text: 'Respond to natural disasters',
    discClass: 'bg-[#E0F5E9] text-[#16A34A] dark:bg-emerald-950/70 dark:text-emerald-300',
  },
  {
    icon: Users,
    text: 'Empower women and youth',
    discClass: 'bg-[#EFE4FD] text-[#8B5CF6] dark:bg-purple-950/70 dark:text-purple-300',
  },
  {
    icon: Cog,
    text: 'Promote sustainable livelihoods',
    discClass: 'bg-[#FEF5D9] text-[#D97706] dark:bg-amber-950/70 dark:text-amber-300',
  },
  {
    icon: PawPrint,
    text: 'Care for animals and the environment',
    discClass: 'bg-[#FDE7E7] text-[#E11D48] dark:bg-rose-950/70 dark:text-rose-300',
  },
];

/**
 * Who We Are & What We Do section.
 *
 * 100% precision match to the approved visual reference:
 * - Prominent white rounded container card with gentle elevation.
 * - 3-column layout:
 *   1. Left: "ABOUT US ——" eyebrow, "Who We Are" heading (with orange "Are"), description, and blue pill button.
 *   2. Center: Primary classroom photograph with top-right radiating orange sunburst rays.
 *   3. Right: "OUR IMPACT ——" eyebrow, "What We Do" heading (with orange "Do"), description, 6 program focus items with tinted icon discs, and "Explore Our Programs →" link.
 */
export function WhoWeAre() {
  return (
    <section
      aria-labelledby="who-we-are-title"
      className="bg-background border-border dark:bg-background relative overflow-hidden border-b py-8 sm:py-10 lg:py-14"
    >
      <PageShell>
        {/* Main White Rounded Card Container */}
        <div className="border-border bg-surface dark:border-border dark:bg-surface relative mx-auto w-full rounded-[28px] border p-6 shadow-[0_12px_44px_rgba(0,0,0,0.06)] sm:rounded-[36px] sm:p-8 md:p-10 lg:p-12 dark:shadow-[0_12px_44px_rgba(0,0,0,0.4)]">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr_1.1fr] lg:items-center lg:gap-8 xl:gap-10">
            {/* ─────────────────────────────────────────────────────────────
                LEFT COLUMN: Who We Are
                ───────────────────────────────────────────────────────────── */}
            <div className="flex flex-col items-start">
              {/* Eyebrow */}
              <div className="mb-2.5 flex items-center gap-2.5">
                <span className="text-primary text-xs font-extrabold uppercase tracking-[0.2em] sm:text-[13px]">
                  ABOUT US
                </span>
                <span className="h-[2px] w-8 rounded-full bg-[#EB6A1F]" aria-hidden="true" />
              </div>

              {/* Heading */}
              <h2
                id="who-we-are-title"
                className="font-display text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl lg:text-[38px] xl:text-[42px] dark:text-white"
              >
                Who We <span className="text-primary">Are</span>
              </h2>

              {/* Description */}
              <p className="mt-4 text-sm font-normal leading-relaxed text-slate-700 sm:text-[15px] lg:text-base dark:text-slate-200">
                Sailent Foundation is a non-profit organization working towards a kinder, fairer and
                more inclusive society. We collaborate with communities, volunteers and partners to
                create sustainable change in education, healthcare, food, disaster relief,
                livelihoods and animal welfare.
              </p>

              {/* Blue Pill Action Button */}
              <Link
                href="/about"
                className="mt-7 inline-flex items-center gap-2.5 rounded-full bg-[#0070BA] px-7 py-3.5 text-sm font-bold text-white shadow-md transition-all duration-200 hover:bg-[#005a96] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0070BA] sm:text-base"
              >
                <span>Learn More About Us</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                CENTER COLUMN: Photograph with Sunburst Rays
                ───────────────────────────────────────────────────────────── */}
            <div className="relative mx-auto w-full max-w-sm sm:max-w-md lg:max-w-none">
              {/* 3 Radiating Orange Sunburst Rays at Top-Right */}
              <div
                className="absolute -right-2 -top-4 z-10 flex items-end gap-1.5 sm:-right-3 sm:-top-5"
                aria-hidden="true"
              >
                <span className="h-3.5 w-1.5 -rotate-[30deg] rounded-full bg-[#EB6A1F]" />
                <span className="h-5 w-1.5 rounded-full bg-[#EB6A1F]" />
                <span className="h-3.5 w-1.5 rotate-[30deg] rounded-full bg-[#EB6A1F]" />
              </div>

              {/* Clean Framed Photograph */}
              <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-[0_8px_28px_rgba(0,0,0,0.07)] sm:rounded-[26px] dark:border-slate-800">
                <MediaFrame
                  media={localMedia(
                    'community-classroom',
                    'Students outside their classroom holding a slate',
                  )}
                  aspect="landscape"
                  rounded={false}
                  sizes="(max-width: 1024px) 90vw, 420px"
                />
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                RIGHT COLUMN: What We Do & Impact Focus Areas
                ───────────────────────────────────────────────────────────── */}
            <div className="flex flex-col items-start">
              {/* Eyebrow */}
              <div className="mb-2.5 flex items-center gap-2.5">
                <span className="text-primary text-xs font-extrabold uppercase tracking-[0.2em] sm:text-[13px]">
                  OUR IMPACT
                </span>
                <span className="h-[2px] w-8 rounded-full bg-[#EB6A1F]" aria-hidden="true" />
              </div>

              {/* Heading */}
              <h2 className="font-display text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl lg:text-[38px] xl:text-[42px] dark:text-white">
                What We <span className="text-primary">Do</span>
              </h2>

              {/* Description */}
              <p className="mt-4 text-sm font-normal leading-relaxed text-slate-700 sm:text-[15px] lg:text-base dark:text-slate-200">
                We design and implement impactful programs that address real needs on the ground.
              </p>

              {/* 6 Program Focus Areas with Colored Icon Discs */}
              <ul className="mt-5 space-y-3 sm:space-y-3.5" aria-label="Our impact programs">
                {IMPACT_PROGRAMS.map((item) => (
                  <li key={item.text} className="flex items-center gap-3.5">
                    <span
                      className={cn(
                        'grid size-8 shrink-0 place-items-center rounded-full sm:size-9',
                        item.discClass,
                      )}
                    >
                      <item.icon
                        className="sm:size-4.5 size-4"
                        strokeWidth={2.3}
                        aria-hidden="true"
                      />
                    </span>
                    <span className="text-sm font-semibold text-slate-800 sm:text-[15px] dark:text-slate-100">
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Explore Our Programs Link */}
              <div className="mt-6">
                <Link
                  href="/programs"
                  className="group inline-flex items-center gap-2 text-sm font-bold text-[#0070BA] transition-colors hover:text-[#005a96] hover:underline sm:text-[15px]"
                >
                  <span>Explore Our Programs</span>
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transform-none"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </PageShell>
    </section>
  );
}
