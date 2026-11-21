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
    <section className="border-border/60 from-info-subtle via-background relative w-full overflow-hidden border-b bg-gradient-to-b to-white">
      {/* Ambient background soft glow */}
      <div
        aria-hidden="true"
        className="bg-info-subtle/40 pointer-events-none absolute -left-20 -top-20 size-[32rem] rounded-full blur-3xl"
      />
      <div
        aria-hidden="true"
        className="bg-accent/20 pointer-events-none absolute right-0 top-0 size-[28rem] rounded-full blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12 xl:gap-16">
          {/* Left Column: Breadcrumb, Eyebrow, Heading, Description, Buttons */}
          <div className="flex flex-col justify-center lg:col-span-6 xl:col-span-6">
            {/* Breadcrumbs matching design: Home > Programs > [Program Name] */}
            <nav aria-label="Breadcrumb" className="mb-6 sm:mb-8">
              <ol className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs font-medium sm:text-sm">
                <li>
                  <Link href="/" className="hover:text-primary transition-colors">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true" className="text-muted-foreground">
                  <ChevronRight className="size-3.5" />
                </li>
                <li>
                  <Link href="/programs" className="hover:text-primary transition-colors">
                    Programs
                  </Link>
                </li>
                <li aria-hidden="true" className="text-muted-foreground">
                  <ChevronRight className="size-3.5" />
                </li>
                <li aria-current="page" className="text-foreground font-bold">
                  {program.name}
                </li>
              </ol>
            </nav>

            {/* Eyebrow */}
            <span className="text-primary text-xs font-extrabold uppercase tracking-[0.16em] sm:text-[13px]">
              PROGRAM
            </span>

            {/* Title */}
            <h1 className="font-display text-foreground mt-2.5 text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              {program.name}
            </h1>

            {/* Description */}
            <p className="text-muted-foreground mt-4 max-w-xl text-base leading-relaxed sm:mt-5 sm:text-lg">
              {description}
            </p>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-4 sm:mt-9">
              <Button
                asChild
                variant="secondary"
                className="shadow-xs border-primary/30 bg-surface text-primary hover:bg-accent inline-flex h-auto items-center justify-center border-2 px-7 py-3.5 text-sm font-bold transition-all sm:text-base"
              >
                <Link href="#campaigns">Explore campaigns</Link>
              </Button>
            </div>
          </div>

          {/* Right Column: Hero Image with rounded-3xl / rounded-[28px] matching design */}
          <div className="lg:col-span-6 xl:col-span-6">
            <div className="border-border/70 shadow-elevated relative overflow-hidden rounded-[24px] border sm:rounded-[28px] lg:rounded-[32px]">
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
