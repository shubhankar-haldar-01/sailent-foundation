import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, cn } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import { ProgramIcon } from '@/components/programs/program-icon';
import type { Program } from '@/lib/mock/types';

/**
 * Program card.
 *
 * `featured` gives the first card in a grid a wider, image-led treatment.
 * Phase 2 explicitly asks that program cards not all be identical where the
 * content differs — a flagship program with three active campaigns should
 * not look the same as one with none.
 */
export function ProgramCard({
  program,
  featured = false,
  className,
}: {
  program: Program;
  featured?: boolean;
  className?: string;
}) {
  return (
    <Card
      interactive
      className={cn(
        'group relative flex overflow-hidden',
        featured ? 'flex-col md:flex-row' : 'flex-col',
        className,
      )}
    >
      <div className={cn(featured && 'md:w-1/2 md:shrink-0')}>
        <MediaFrame
          media={program.cover}
          aspect={featured ? 'photo' : 'video'}
          rounded={false}
          className={cn(featured && 'md:h-full')}
        />
      </div>

      <div className={cn('flex flex-1 flex-col gap-3 p-5', featured && 'md:justify-center md:p-8')}>
        <ProgramIcon accent={program.accentIcon} />

        <h3 className={cn('font-display font-bold leading-snug', featured ? 'text-h2' : 'text-h4')}>
          <Link
            href={`/programs/${program.slug}`}
            className="hover:text-primary focus-visible:outline-ring rounded-sm after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {program.name}
          </Link>
        </h3>

        <p
          className={cn(
            'text-muted-foreground',
            featured ? 'text-body' : 'text-body-sm line-clamp-3',
          )}
        >
          {featured ? program.tagline : program.shortDescription}
        </p>

        <div className="mt-auto flex items-center gap-3 pt-2">
          <span className="text-caption text-muted-foreground">
            {program.activeCampaignCount > 0 ? (
              <>
                <span data-numeric="">{program.activeCampaignCount}</span> active{' '}
                {program.activeCampaignCount === 1 ? 'campaign' : 'campaigns'}
              </>
            ) : (
              'Ongoing program'
            )}
          </span>
          <ArrowRight
            aria-hidden="true"
            className="text-muted-foreground ml-auto size-4 transition-transform group-hover:translate-x-0.5"
          />
        </div>
      </div>
    </Card>
  );
}
