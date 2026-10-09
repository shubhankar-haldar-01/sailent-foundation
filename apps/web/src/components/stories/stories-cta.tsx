import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button, cn } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import { FilledSprig, TripleRays } from './stories-decor';

/**
 * The band that closes the Stories page (owner's page design, 2026-10-08):
 * a soft peach panel with the ask on the left and two framed photographs on
 * the right. The photographs are illustrative and `aria-hidden`.
 */
export function StoriesCta() {
  return (
    <section aria-labelledby="stories-cta-heading" className="pb-14 pt-4 md:pb-16">
      <div className="container-page">
        <div className="bg-primary-soft min-[70rem]:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] relative grid items-center gap-8 overflow-hidden rounded-[1.25rem] px-6 py-8 sm:px-12 lg:-mx-[1.125rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-3 lg:py-[1.125rem] lg:pl-[4.125rem] lg:pr-4">
          <div className="relative">
            <TripleRays className="text-cta-glow absolute -left-9 -top-6 hidden w-9 -rotate-90 sm:block" />
            <p className="text-primary text-caption font-bold uppercase tracking-[0.04em]">
              Be part of the change
            </p>
            <h2
              id="stories-cta-heading"
              className="font-display mt-2 text-[clamp(1.6rem,1.2rem+1.4vw,2.0625rem)] font-bold leading-tight tracking-[-0.01em]"
            >
              Support more stories like these
            </h2>
            <p className="text-muted-foreground mt-3 max-w-[31rem] text-[0.875rem] leading-[1.6]">
              <span className="lg:block">
                Your support helps us continue long-term work in education,{' '}
              </span>
              health, livelihoods, animal welfare, disaster relief and the environment.
            </p>
            <Button
              asChild
              className="mt-6 h-12 rounded-full px-[4.75rem] text-[0.9375rem] font-bold"
            >
              <Link href="/donate">
                Donate Now
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <div
            aria-hidden="true"
            className="relative mx-auto aspect-[500/235] w-full max-w-[31rem]"
          >
            <FilledSprig className="text-info-action/45 absolute -left-[3%] top-[30.2%] h-[67.8%] w-auto" />
            <FilledSprig
              flip
              className="text-info-action/45 absolute -top-[7%] left-[66%] h-[49.1%] w-auto"
            />
            <FilledSprig className="text-wash-mint-ink/45 absolute -right-[2%] top-[65.3%] h-[32.7%] w-auto" />
            <FilledSprig className="text-cta-glow/30 absolute right-[2%] top-[1%] h-[35.1%] w-auto" />
            <Framed
              url="/images/about-presence-walk.webp"
              focus="center 40%"
              className="left-[8%] top-[1%] h-[92%] w-[62%] -rotate-[3deg]"
              sizes="320px"
            />
            <Framed
              url="/images/campaign-greener-communities-bhopal.webp"
              focus="12% 60%"
              className="left-[58%] top-[23%] h-[75%] w-[34%] rotate-[4deg]"
              sizes="170px"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Framed({
  url,
  focus,
  className,
  sizes,
}: {
  url: string;
  focus?: string;
  className: string;
  sizes: string;
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
        focus={focus}
        className="aspect-auto size-full rounded-[0.95rem]"
        sizes={sizes}
      />
    </div>
  );
}
