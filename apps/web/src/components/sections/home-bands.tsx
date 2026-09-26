import Link from 'next/link';

import { Button } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import { NewsletterForm } from '@/components/layout/newsletter-form';
import { PageShell } from '@/components/layout/page-shell';
import { ScriptAccent } from '@/components/sections/script-accent';

/**
 * The closing bands of the homepage: volunteer, newsletter, mission, partners.
 *
 * Kept together because they are one rhythm — three calls to action of
 * descending weight, then the partner strip. Splitting them across four files
 * would hide the fact that they have to be balanced against each other.
 */

export function VolunteerBand() {
  return (
    <section className="border-border border-t">
      <PageShell>
        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          <div className="border-border bg-surface-sunken flex flex-col justify-center rounded-xl border p-8 lg:p-10">
            <p className="text-overline tracking-(--text-overline--letter-spacing) text-primary uppercase">
              Be the change
            </p>
            <h2 className="font-display text-h1 mt-2 text-balance font-bold tracking-tight">
              Join Our Community of Change Makers
            </h2>
            <p className="text-body text-muted-foreground mt-4 max-w-md leading-relaxed">
              Your time, skills and support can create brighter futures. Volunteer, partner or
              donate to make a real difference.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link href="/volunteer">Become a Volunteer</Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="rounded-full">
                <Link href="/about">Learn More</Link>
              </Button>
            </div>
          </div>

          {/* `lg:aspect-auto` matters: with a fixed aspect ratio, a forced
              height computes the WIDTH from it — `min-h-64` on a 4/3 frame
              demanded 341px inside a 288px column and scrolled the whole page
              sideways at 320px. Below lg the ratio drives height from width,
              which is the way round that cannot overflow. */}
          <MediaFrame
            media={{
              seed: 'volunteers-together',
              alt: 'Volunteers in branded shirts standing together at a field event',
            }}
            aspect="photo"
            className="w-full lg:aspect-auto lg:h-full"
          />
        </div>
      </PageShell>
    </section>
  );
}

export function NewsletterBand() {
  return (
    <section className="border-border border-t">
      <PageShell>
        <div className="border-border bg-accent/40 relative overflow-hidden rounded-xl border p-8 lg:p-10">
          <div className="max-w-xl">
            <h2 className="font-display text-h2 text-balance font-bold tracking-tight">
              Stay Updated
            </h2>
            <p className="text-body text-muted-foreground mt-2 leading-relaxed">
              Get the latest stories, updates and opportunities delivered to your inbox.
            </p>
            <div className="mt-6">
              <NewsletterForm />
            </div>
          </div>

          <ScriptAccent
            size="md"
            className="text-primary pointer-events-none absolute bottom-6 right-6 hidden max-w-[9rem] text-right lg:block"
          >
            Good People Create Great Change
          </ScriptAccent>
        </div>
      </PageShell>
    </section>
  );
}

export function MissionBand() {
  return (
    <section>
      <PageShell>
        {/* The one full-bleed dark panel on the page. Its scarcity is what
            makes it read as the closing statement rather than as another card. */}
        <div className="bg-primary text-primary-foreground relative overflow-hidden rounded-xl p-8 lg:p-12">
          <p className="text-overline tracking-(--text-overline--letter-spacing) uppercase opacity-80">
            Together, we can do more
          </p>
          <h2 className="font-display text-h1 mt-2 max-w-xl text-balance font-bold tracking-tight">
            Support Our Mission
          </h2>
          <p className="text-body mt-4 max-w-xl leading-relaxed opacity-90">
            Your contribution helps us create lasting change in the lives of those who need it most.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {/* On a dark panel the filled primary button would disappear into
                its own background, so the roles invert: white becomes the
                filled action and the outline sits on the panel. */}
            <Button
              asChild
              size="lg"
              className="text-primary rounded-full bg-white hover:bg-white/90"
            >
              <Link href="/donate">Donate Now</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="hover:bg-white/12 rounded-full border border-white/35 bg-transparent text-white"
            >
              <Link href="/programs">Explore Our Programs</Link>
            </Button>
          </div>

          <ScriptAccent
            size="md"
            className="pointer-events-none absolute bottom-8 right-8 hidden max-w-[8rem] text-right opacity-80 lg:block"
          >
            People Purpose Possibilities
          </ScriptAccent>
        </div>
      </PageShell>
    </section>
  );
}

/**
 * Partner logos.
 *
 * Renders nothing until real partners are supplied. A logo on this strip is a
 * claim that an organization endorses or works with us, and an unearned one is
 * the most damaging kind of placeholder a charity site can carry — it is the
 * sort of thing a journalist checks first, and there is no version of being
 * caught at it that ends well.
 *
 * When real partnerships exist they belong in the database alongside the rest
 * of the content, not in this file.
 */
export function PartnersBand({
  partners = [],
}: {
  partners?: { name: string; logoUrl: string | null; url?: string }[];
}) {
  if (partners.length === 0) return null;

  return (
    <section className="border-border border-t">
      <PageShell>
        <p className="text-overline tracking-(--text-overline--letter-spacing) text-muted-foreground uppercase">
          In collaboration
        </p>
        <h2 className="font-display text-h2 mt-2 font-bold tracking-tight">Our Partners</h2>
        <p className="text-body text-muted-foreground mt-2">
          Working together for a greater impact.
        </p>

        <ul className="mt-8 flex flex-wrap items-center gap-x-10 gap-y-6">
          {partners.map((partner) => (
            <li key={partner.name} className="text-muted-foreground text-body-sm font-medium">
              {partner.name}
            </li>
          ))}
        </ul>
      </PageShell>
    </section>
  );
}
