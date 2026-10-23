import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Button } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import type { Program } from '@/lib/mock/types';

interface ProgramDetailHeroProps {
  program: Program;
}

export function ProgramDetailHero({ program }: ProgramDetailHeroProps) {
  const description =
    program.slug === 'education'
      ? 'Helping children stay in school and access the support they need to learn, grow and build a brighter future.'
      : program.tagline ||
        program.shortDescription ||
        'Helping children stay in school and access the support they need to learn, grow and build a brighter future.';

  return (
    <section className="relative w-full overflow-hidden border-b border-slate-200/60 bg-gradient-to-b from-[#F2F8FD] via-[#F8FBFE] to-white">
      {/* Ambient background soft glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 -top-20 size-[32rem] rounded-full bg-sky-100/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 size-[28rem] rounded-full bg-orange-100/20 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12 xl:gap-16">
          {/* Left Column: Breadcrumb, Eyebrow, Heading, Description, Buttons */}
          <div className="flex flex-col justify-center lg:col-span-6 xl:col-span-6">
            {/* Breadcrumbs matching design: Home > Programs > [Program Name] */}
            <nav aria-label="Breadcrumb" className="mb-6 sm:mb-8">
              <ol className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500 sm:text-sm">
                <li>
                  <Link href="/" className="hover:text-primary transition-colors">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true" className="text-slate-400">
                  <ChevronRight className="size-3.5" />
                </li>
                <li>
                  <Link href="/programs" className="hover:text-primary transition-colors">
                    Programs
                  </Link>
                </li>
                <li aria-hidden="true" className="text-slate-400">
                  <ChevronRight className="size-3.5" />
                </li>
                <li aria-current="page" className="font-bold text-[#0A2540]">
                  {program.name}
                </li>
              </ol>
            </nav>

            {/* Eyebrow */}
            <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#EB6A1F] sm:text-[13px]">
              PROGRAM
            </span>

            {/* Title */}
            <h1 className="font-display mt-2.5 text-4xl font-black leading-[1.08] tracking-tight text-[#0A2540] sm:text-5xl lg:text-[3.5rem]">
              {program.name}
            </h1>

            {/* Description */}
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[#486581] sm:mt-5 sm:text-lg">
              {description}
            </p>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-4 sm:mt-9">
              <Button
                asChild
                variant="secondary"
                className="shadow-xs inline-flex h-auto items-center justify-center rounded-full border-2 border-[#1E88E5] bg-white px-7 py-3.5 text-sm font-bold text-[#1E88E5] transition-all hover:bg-[#F0F7FF] hover:text-[#1976D2] sm:text-base"
              >
                <Link href="#campaigns">Explore campaigns</Link>
              </Button>
            </div>
          </div>

          {/* Right Column: Hero Image with rounded-3xl / rounded-[28px] matching design */}
          <div className="lg:col-span-6 xl:col-span-6">
            <div className="relative overflow-hidden rounded-[24px] border border-slate-200/70 shadow-[0_12px_36px_-10px_rgba(0,0,0,0.12)] sm:rounded-[28px] lg:rounded-[32px]">
              <MediaFrame
                media={program.cover}
                aspect="hero"
                priority
                rounded={false}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="aspect-[4/3] w-full object-cover sm:aspect-[16/10]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
