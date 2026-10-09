import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { cn } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import { ProgramIcon } from '@/components/programs/program-icon';
import type { Program } from '@/lib/mock/types';

/**
 * Program card, matched to the owner's programs design (2026-10-08): the
 * photograph across the top, the area's icon on a white ring overlapping its
 * lower edge, then the name, the short description and the count of open
 * campaigns beside an arrow.
 *
 * THE WHOLE CARD IS ONE LINK. The name is the only anchor; its `::after`
 * stretches over the card, so a click anywhere lands on the program while a
 * screen reader hears one link with a meaningful name rather than three. The
 * arrow is decoration. A keyboard focus ring is drawn round the whole card.
 */
export function ProgramCard({
  program,
  className,
  imagePriority = false,
}: {
  program: Program;
  className?: string;
  /** The first row on a phone is above the fold. */
  imagePriority?: boolean;
}) {
  const description = program.shortDescription || program.tagline;
  const count = program.activeCampaignCount;

  return (
    <article
      className={cn(
        'border-border/70 bg-surface group relative flex h-full flex-col overflow-hidden rounded-2xl border',
        'shadow-[0_10px_28px_-22px_rgb(15_23_42/0.35)]',
        'duration-(--duration-base) ease-(--ease-out-soft) transition-[translate,box-shadow]',
        'hover:shadow-[0_18px_36px_-22px_rgb(15_23_42/0.4)] motion-safe:hover:-translate-y-0.5',
        'has-[a:focus-visible]:outline-ring has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2',
        className,
      )}
    >
      <MediaFrame
        media={program.cover}
        aspect="landscape"
        rounded={false}
        priority={imagePriority}
        className="aspect-[12/7]"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 440px"
      />

      <div className="relative flex flex-1 flex-col px-5 pb-5 sm:px-6 sm:pb-6">
        {/* Half over the photograph, on a white ring — as the design draws it. */}
        <span className="bg-surface relative -mt-8 inline-grid w-fit place-items-center rounded-full p-1 shadow-[0_6px_16px_-10px_rgb(15_23_42/0.4)]">
          <ProgramIcon
            accent={program.accentIcon}
            area={program.category ?? program.name}
            className="size-14"
            iconClassName="size-6.5"
          />
        </span>

        <h3 className="font-display text-foreground mt-3 text-[1.3125rem] font-semibold leading-snug tracking-[-0.01em] lg:text-[1.375rem]">
          <Link
            href={`/programs/${program.slug}`}
            className="group-hover:text-primary transition-colors after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none"
          >
            {program.name}
          </Link>
        </h3>

        {description ? (
          <p className="text-body text-muted-foreground mt-2 line-clamp-3 leading-relaxed lg:text-[1.0625rem]">
            {description}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <span className="text-muted-foreground text-[0.9375rem] font-medium lg:text-base">
            {count > 0 ? (
              <>
                <span data-numeric="">{count}</span> active {count === 1 ? 'campaign' : 'campaigns'}
              </>
            ) : (
              'Ongoing program'
            )}
          </span>
          <span
            aria-hidden="true"
            className="bg-primary/10 text-cta-glow duration-(--duration-base) group-hover:bg-primary group-hover:text-primary-foreground grid size-10 shrink-0 place-items-center rounded-full transition-colors"
          >
            <ArrowRight
              className="size-[1.125rem] transition-transform motion-safe:group-hover:translate-x-0.5"
              strokeWidth={2.2}
            />
          </span>
        </div>
      </div>
    </article>
  );
}
