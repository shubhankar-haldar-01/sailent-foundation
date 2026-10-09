import { Heart } from 'lucide-react';

import { cn } from '@sailent/ui';

import { PeopleIcon } from '@/components/about/decor';
import { PageShell } from '@/components/layout/page-shell';
import { MediaFrame } from '@/components/media/media-frame';
import { headingExtraBold } from '@/lib/fonts';
import { localMedia } from '@/lib/media/public-asset';

import {
  GreenSprig,
  HERO_SHAPE_ID,
  HeroShapeDefs,
  LeafOutline,
  PeachBlob,
  PlantIcon,
  SunBurst,
} from './decor';

/** The three principles under the introduction — words, not figures. */
const PRINCIPLES: {
  icon: (props: { className?: string }) => React.ReactNode;
  lines: [string, string];
}[] = [
  { icon: PlantIcon, lines: ['Community', 'led solutions'] },
  { icon: PeopleIcon, lines: ['Sustainable', 'impact'] },
  { icon: HeartIcon, lines: ['Real people', 'real change'] },
];

function HeartIcon({ className }: { className?: string }) {
  return <Heart className={className} strokeWidth={1.8} />;
}

/**
 * The programs page's hero, matched to the owner's design (2026-10-08).
 *
 * Two columns from `lg`: the introduction and its three principles on the
 * left; on the right the photograph in an organic outline, with a peach shape
 * behind its left edge, a pale sun with orange rays at its top corner, a
 * hand-drawn orange leaf over its left edge and a sage sprig at its lower
 * right. (The design's small card over the photograph was removed at the
 * owner's request, 2026-10-08.)
 *
 * THE PHOTOGRAPH IS FRAMED AS WIDE AS IT IS. The design shows the girl at
 * about half the frame's width, with her classmates either side. The supplied
 * photograph is a wide 2:1 crop, so a frame as tall as the design's would have
 * to zoom in on her face; this frame is a little wider instead, which keeps
 * her at the design's scale without inventing any of the picture.
 *
 * ON A PHONE IT IS NOT THE DESKTOP SHRUNK: the introduction, then the
 * photograph, then the principles as three columns. The source order is that
 * phone order; the desktop grid places the principles back under the text.
 *
 * Nothing here is a figure: the principles are statements of approach, not
 * claims to be counted.
 */
export function ProgramsHero() {
  const photo = localMedia(
    'campaigns-hero-education',
    'A schoolgirl in uniform smiling, her classmates behind her',
  );

  return (
    <section
      aria-labelledby="programs-title"
      className="relative overflow-x-clip pb-14 pt-10 md:pb-16 md:pt-14 lg:pb-3 lg:pt-12"
    >
      <HeroShapeDefs />
      <PageShell className="grid gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:grid-rows-[auto_auto] lg:gap-x-12 lg:gap-y-11">
        <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
          <p className="text-primary text-[0.875rem] font-bold uppercase tracking-[0.04em] sm:text-[0.9375rem]">
            Our programs
          </p>
          <h1
            id="programs-title"
            className={cn(
              headingExtraBold.className,
              'text-foreground mt-2.5 text-[clamp(1.875rem,1.1rem+2.9vw,3.125rem)] leading-[1.16] tracking-[-0.025em] lg:text-[clamp(2.5rem,0.4rem+3.25vw,3.3125rem)]',
            )}
          >
            {/* Broken where the design breaks it; "one-off" never splits at its hyphen. */}
            <span className="block">Long-term work, </span>
            <span className="block text-balance">
              not <span className="whitespace-nowrap">one-off</span> projects
            </span>
          </h1>
          {/* Narrower between 1024 and 1440px, where the photograph's decorations come closer. */}
          <p className="text-foreground/85 min-[90rem]:max-w-[36rem] mt-5 max-w-[36rem] text-[1.0625rem] leading-relaxed sm:text-lg lg:max-w-[26rem] xl:max-w-[30rem]">
            Our programs run for years and are measured over time. Campaigns fund specific pieces of
            them, which is why a campaign always belongs to a program.
          </p>
        </div>

        {/*
          The photograph and its decorations, positioned in the frame's own
          percentages. The frame leaves clear room on its right for the whole
          sprig: 82% of the column from `lg`, and set in from the right on a
          phone and a tablet.
        */}
        <div className="relative mx-auto w-full max-w-[37rem] max-sm:ml-4 max-sm:mr-auto max-sm:w-[calc(100%-5rem)] sm:max-lg:max-w-[26rem] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mx-0 lg:w-[82%] lg:self-center">
          <PeachBlob className="text-(--cta-100)/60 dark:text-cta-glow/12 lg:max-[90rem]:-left-[14%] lg:max-[90rem]:w-[30%] absolute -left-[20%] top-[4%] h-[74%] w-[36%] max-sm:-left-[9%] max-sm:w-[30%]" />

          <div className="relative" style={{ clipPath: `url(#${HERO_SHAPE_ID})` }}>
            <MediaFrame
              media={photo}
              aspect="photo"
              rounded={false}
              priority
              // Her face a little right of centre, classmates on both sides.
              focus="16% 50%"
              className="aspect-[592/440]"
              sizes="(max-width: 640px) 80vw, (max-width: 1024px) 416px, 544px"
            />
          </div>

          {/* The sun and the sketched leaf sit over the photograph's edge, as in the design. */}
          <SunBurst
            className="text-cta-glow lg:max-[90rem]:-left-[2%] absolute -left-[3.3%] -top-[1%] h-auto w-[18%]"
            sunClassName="fill-(--cta-100)/55 dark:fill-cta-glow/15"
          />
          <LeafOutline className="text-cta-glow/80 lg:max-[90rem]:-left-[10%] absolute -left-[15%] top-[26%] h-[44%] w-auto max-sm:-left-[8%] max-sm:h-[38%]" />
          {/*
            The whole sprig, in the clear space just right of the photograph —
            never over it, and never cut off (owner, 2026-10-08).
          */}
          <GreenSprig className="absolute left-[calc(100%+0.25rem)] top-[40%] h-[52%] w-auto sm:top-[36%] sm:h-[60%]" />
        </div>

        {/*
          Three across at every width. Side by side with its label wherever the
          row has room — a single-column hero from `sm`, and the full desktop
          column from 1400px, on the design's even spacing — and the icon over
          its label in between, where the column is too narrow for three pairs.
        */}
        <ul className="min-[87.5rem]:grid-cols-[minmax(0,14.375rem)_minmax(0,14.375rem)_auto] min-[87.5rem]:gap-x-0 grid grid-cols-3 gap-3 sm:flex sm:gap-x-9 lg:col-start-1 lg:row-start-2 lg:grid lg:gap-x-6 lg:self-start">
          {PRINCIPLES.map(({ icon: Icon, lines }) => (
            <li
              key={lines[0]}
              className="min-[87.5rem]:flex-row min-[87.5rem]:items-center flex flex-col items-center gap-2.5 text-center sm:flex-row sm:gap-3.5 sm:text-left lg:flex-col lg:items-start lg:gap-3"
            >
              <span
                aria-hidden="true"
                className="text-cta-glow dark:bg-primary/10 bg-(--cta-50) min-[87.5rem]:size-16 grid size-14 shrink-0 place-items-center rounded-full"
              >
                <Icon className="min-[87.5rem]:size-7 size-6" />
              </span>
              <span className="text-foreground min-[87.5rem]:text-base text-[0.875rem] font-semibold leading-snug sm:text-[0.9375rem]">
                <span className="block">{lines[0]} </span>
                <span className="block">{lines[1]}</span>
              </span>
            </li>
          ))}
        </ul>
      </PageShell>
    </section>
  );
}
