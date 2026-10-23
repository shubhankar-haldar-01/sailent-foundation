import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { cn } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import { ProgramIcon } from '@/components/programs/program-icon';
import { headingExtraBold } from '@/lib/fonts';
import type { Program } from '@/lib/mock/types';

/**
 * Program card, matched to the owner's programs design (2026-10-14): a
 * compact row — the photograph on the left, about two fifths of the card and
 * as tall as the card; on the right the area's icon on a soft disc, the name,
 * the short description, and the count of open campaigns beside an arrow.
 *
 * THE PHOTOGRAPH TAKES THE CARD'S HEIGHT, not a fixed shape, so the three
 * cards in a row stay the same height whatever their descriptions run to
 * (three lines at most). On a phone the row is too narrow for two columns,
 * so the photograph goes on top, wide and short, and the text below it.
 *
 * The outline and shadow are the design's cool blue-grey rather than the
 * shared `card-interactive` warm tint, so they are set here.
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
        'card-interactive group relative flex h-full gap-4 rounded-xl p-3.5 max-sm:flex-col sm:gap-6 dark:border-slate-800 dark:bg-slate-900',
        'has-[a:focus-visible]:outline-ring has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2',
        className,
      )}
    >
      {/* 16:9 across the top on a phone; from `sm`, a column as tall as the card. */}
      <MediaFrame
        media={program.cover}
        aspect="video"
        rounded={false}
        priority={imagePriority}
        className="w-full shrink-0 rounded-[0.625rem] sm:aspect-auto sm:min-h-[10.5rem] sm:w-[44%] sm:max-w-[12rem]"
        sizes="(max-width: 30rem) 100vw, 12rem"
      />

      <div className="flex min-w-0 flex-1 flex-col sm:pt-1">
        <ProgramIcon
          accent={program.accentIcon}
          area={program.category ?? program.name}
          className="size-10"
          iconClassName="size-5"
        />

        <h3
          className={cn(
            headingExtraBold.className,
            'text-foreground mt-2.5 text-lg leading-tight tracking-[-0.015em]',
          )}
        >
          <Link
            href={`/programs/${program.slug}`}
            className="group-hover:text-primary transition-colors after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
          >
            {program.name}
          </Link>
        </h3>

        {description ? (
          <p className="text-foreground/80 mt-1.5 line-clamp-3 text-sm leading-[1.5]">
            {description}
          </p>
        ) : null}

        {/* At the foot of the column, so the arrow sits in the card's corner whatever the description runs to. */}
        <div className="mt-auto flex items-center justify-between gap-3 pt-2.5">
          <span className="text-foreground/75 text-sm">
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
            className="bg-cta/12 text-cta-glow duration-(--duration-base) group-hover:bg-primary group-hover:text-primary-foreground size-8.5 grid shrink-0 place-items-center rounded-full transition-colors"
          >
            <ArrowRight
              className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5"
              strokeWidth={2.2}
            />
          </span>
        </div>
      </div>
    </article>
  );
}
