import { BookOpen, Heart, UserRound, type LucideIcon } from 'lucide-react';
import { cn } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import { FilledSprig, OutlineLeaves, TripleRays } from './stories-decor';

/**
 * The Stories page's opening band (owner's page design, 2026-10-08).
 *
 * Title, lead and three promises on the left; on the right a collage of three
 * portraits, each in a white frame at its own slight angle, over a peach wash
 * with line-art and filled leaves. The collage is laid out in PERCENTAGES of
 * a fixed-ratio box, so it scales down whole on a narrower screen rather than
 * rearranging. The portraits are illustrative photographs, not the subjects
 * of the stories below — they are `aria-hidden` with empty alt text.
 */
const PROMISES: { icon: LucideIcon; lines: [string, string] }[] = [
  { icon: UserRound, lines: ['Real people', 'real stories'] },
  { icon: BookOpen, lines: ['Stories from', 'the ground'] },
  { icon: Heart, lines: ['Hope that', 'inspires change'] },
];

export function StoriesHero() {
  return (
    <section aria-labelledby="stories-title" className="overflow-hidden">
      <div className="container-page min-[70rem]:grid-cols-[minmax(0,1fr)_minmax(0,31.5rem)] grid items-center gap-10 pb-8 pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,25.5rem)] lg:gap-2 lg:pb-0 lg:pl-[3.125rem] lg:pr-[1.875rem] lg:pt-2">
        <div className="lg:pb-3">
          <p className="text-primary text-caption font-bold uppercase tracking-[0.06em]">Stories</p>
          <h1
            id="stories-title"
            className="font-display mt-2 text-balance text-[clamp(2rem,1.4rem+2vw,2.4rem)] font-bold leading-[1.08] tracking-[-0.01em]"
          >
            <span className="sm:block">One person, one program, </span>
            <span className="sm:block">one thing that changed</span>
          </h1>
          <p className="text-muted-foreground mt-4 max-w-[30rem] text-[0.9375rem] leading-[1.5]">
            Real stories from real people — children, families and communities whose lives are
            changing through our long-term work.
          </p>

          <ul className="mt-6 flex flex-wrap gap-x-9 gap-y-4">
            {PROMISES.map(({ icon: Icon, lines }) => (
              <li key={lines[0]} className="flex items-center gap-3.5">
                <span
                  aria-hidden="true"
                  className="bg-wash-coral text-cta-glow grid size-[3.25rem] shrink-0 place-items-center rounded-full"
                >
                  <Icon className="size-[1.375rem]" strokeWidth={1.75} />
                </span>
                <span className="text-foreground text-[0.8125rem] font-medium leading-[1.6]">
                  {lines[0]}
                  <br />
                  {lines[1]}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Collage />
      </div>
    </section>
  );
}

/** A photograph in a white frame, turned by `rotate`. */
function FramedPhoto({
  url,
  focus,
  className,
  sizes,
  priority,
}: {
  url: string;
  focus?: string;
  className: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        'absolute rounded-[1.25rem] border-[5px] border-white shadow-[0_14px_30px_-14px_rgb(15_23_42/0.45)] dark:border-neutral-200',
        className,
      )}
    >
      <MediaFrame
        media={{ seed: url, alt: '', url }}
        rounded={false}
        priority={priority}
        focus={focus}
        className="aspect-auto size-full rounded-[0.95rem]"
        sizes={sizes}
      />
    </div>
  );
}

function Collage() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto aspect-[505/325] w-full max-w-[31.5rem] lg:mx-0 lg:justify-self-end"
    >
      {/* Peach washes behind the photographs. */}
      <span className="bg-wash-coral absolute left-0 top-[24%] aspect-square w-[38%] rounded-full" />
      <span className="bg-wash-coral absolute left-[88%] top-[17%] h-[77%] w-[14%] rounded-full" />

      <OutlineLeaves className="text-cta-glow/70 absolute -left-[1%] top-[10.5%] h-[51.5%] w-auto" />
      <FilledSprig className="text-wash-mint-ink/45 absolute -left-[1%] top-[46.9%] h-[49.1%] w-auto" />
      <TripleRays className="text-cta-glow absolute -top-[1%] left-[81%] w-[11%]" />
      <FilledSprig className="text-wash-mint-ink/45 absolute left-[90%] top-[69%] h-[21%] w-auto" />

      <FramedPhoto
        url="/images/campaigns-hero-education.webp"
        focus="38% 30%"
        priority
        className="left-[15%] top-[2%] h-[93%] w-[59%] rotate-[3deg]"
        sizes="(max-width: 1024px) 60vw, 300px"
      />
      <FramedPhoto
        url="/images/16_story_priya.webp"
        focus="center 30%"
        className="left-[71%] top-[17%] h-[47%] w-[29%] rotate-[9deg]"
        sizes="160px"
      />
      <FramedPhoto
        url="/images/15_story_ramesh.webp"
        focus="center 35%"
        className="left-[63%] top-[55%] h-[36%] w-[26%] rotate-[-4deg]"
        sizes="140px"
      />
    </div>
  );
}
