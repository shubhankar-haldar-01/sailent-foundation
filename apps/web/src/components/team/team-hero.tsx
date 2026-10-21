import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, Heart, Target, Users } from 'lucide-react';

export function TeamHero() {
  return (
    <section aria-labelledby="team-hero-title" className="relative pt-4 sm:pt-6">
      <div className="relative overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.03)] sm:rounded-[32px] dark:border-slate-800 dark:bg-slate-900">
        <div className="grid items-center lg:grid-cols-12">
          {/* Left Column: Breadcrumbs + Text Content + Highlights */}
          <div className="flex flex-col justify-center p-6 sm:p-8 lg:col-span-7 lg:p-10 xl:p-12">
            {/* Breadcrumb Navigation */}
            <nav aria-label="Breadcrumb" className="mb-4">
              <ol className="flex items-center gap-1.5 text-xs text-slate-500 sm:text-[13px] dark:text-slate-400">
                <li>
                  <Link href="/" className="transition-colors hover:text-[#EB6A1F] hover:underline">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true" className="text-slate-400">
                  <ChevronRight className="size-3.5" />
                </li>
                <li>
                  <Link
                    href="/about"
                    className="transition-colors hover:text-[#EB6A1F] hover:underline"
                  >
                    About Us
                  </Link>
                </li>
                <li aria-hidden="true" className="text-slate-400">
                  <ChevronRight className="size-3.5" />
                </li>
                <li
                  className="font-semibold text-slate-800 dark:text-slate-200"
                  aria-current="page"
                >
                  Our Team
                </li>
              </ol>
            </nav>

            {/* Pill Tag */}
            <span className="inline-block w-fit rounded-full bg-[#FFF4EC] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#EB6A1F] dark:bg-orange-950/60 dark:text-orange-400">
              OUR TEAM
            </span>

            {/* Heading */}
            <h1
              id="team-hero-title"
              className="mt-3 text-3xl font-black tracking-tight text-[#0F172A] sm:text-4xl lg:text-[44px] lg:leading-[1.12] dark:text-white"
            >
              Meet <span className="text-[#EB6A1F]">Our Team</span>
            </h1>

            {/* Subtitle */}
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
              A dedicated group of people working together to support communities, create
              opportunities, and build a better tomorrow.
            </p>

            {/* 3 Feature Badges */}
            <div className="mt-6 flex flex-wrap items-center gap-4 sm:gap-6 lg:mt-8">
              {/* Badge 1: Passionate Professionals */}
              <div className="flex items-center gap-3">
                <div
                  aria-hidden="true"
                  className="flex size-10 items-center justify-center rounded-full border border-orange-200/60 bg-[#FFF4EC] text-[#EB6A1F] sm:size-11 dark:border-orange-900/40 dark:bg-orange-950/60 dark:text-orange-400"
                >
                  <Users className="size-5" strokeWidth={2} />
                </div>
                <div className="text-xs font-bold leading-tight text-slate-800 sm:text-sm dark:text-slate-100">
                  <p>Passionate</p>
                  <p>Professionals</p>
                </div>
              </div>

              {/* Badge 2: Community Focused */}
              <div className="flex items-center gap-3">
                <div
                  aria-hidden="true"
                  className="flex size-10 items-center justify-center rounded-full border border-orange-200/60 bg-[#FFF4EC] text-[#EB6A1F] sm:size-11 dark:border-orange-900/40 dark:bg-orange-950/60 dark:text-orange-400"
                >
                  <Heart className="size-5" strokeWidth={2} />
                </div>
                <div className="text-xs font-bold leading-tight text-slate-800 sm:text-sm dark:text-slate-100">
                  <p>Community</p>
                  <p>Focused</p>
                </div>
              </div>

              {/* Badge 3: Working for a Brighter Tomorrow */}
              <div className="flex items-center gap-3">
                <div
                  aria-hidden="true"
                  className="flex size-10 items-center justify-center rounded-full border border-orange-200/60 bg-[#FFF4EC] text-[#EB6A1F] sm:size-11 dark:border-orange-900/40 dark:bg-orange-950/60 dark:text-orange-400"
                >
                  <Target className="size-5" strokeWidth={2} />
                </div>
                <div className="text-xs font-bold leading-tight text-slate-800 sm:text-sm dark:text-slate-100">
                  <p>Working for a</p>
                  <p>Brighter Tomorrow</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Banner Image with Organic Wave Divider */}
          <div className="relative min-h-[260px] sm:min-h-[360px] lg:col-span-5 lg:h-full lg:min-h-[440px]">
            {/* The photo */}
            <Image
              src="/images/team-hero-banner.webp"
              alt="Sailent Foundation coordinator with children in outdoor community setting"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover object-center"
            />

            {/* Organic curved shape divider overlapping the left edge */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-y-0 -left-1 z-10 hidden h-full w-20 fill-white text-white sm:block sm:w-28 lg:w-36 dark:fill-slate-900 dark:text-slate-900"
              aria-hidden="true"
            >
              <path d="M0,0 L45,0 C75,25 78,60 40,82 C22,94 10,98 0,100 Z" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
