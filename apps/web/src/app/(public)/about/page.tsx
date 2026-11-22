import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BookOpen,
  ChartNoAxesColumnIncreasing,
  Eye,
  FileText,
  HeartPulse,
  Info,
  Leaf,
  Map as MapIcon,
  MapPin,
  Target,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { Button, cn } from '@sailent/ui';

import { PageShell } from '@/components/layout/page-shell';
import { IndiaPresenceMap } from '@/components/about/india-presence-map';
import { InteriorHero } from '@/components/sections/interior-hero';
import { buildMetadata } from '@/lib/seo/metadata';
import { getImpact, getTeam } from '@/lib/content';
import {
  formatRegisteredOn,
  getOrganisation,
  getOrganisationRecords,
  type Organisation,
} from '@/lib/content/organisation';

/**
 * The statutory identifiers, verifiable against the public registers.
 *
 * Moved here when `/transparency` was removed. From Admin → Settings since
 * Phase 13 (`getOrganisation`); a field nobody has entered is left out. In
 * development an empty field shows the DEMO value, marked so it cannot be
 * mistaken for a real registration, and the note below the list says so.
 */
function registrationFields(organisation: Organisation) {
  return [
    { label: 'Registered name', value: organisation.name },
    { label: 'Registered as', value: organisation.registeredAs },
    { label: 'Registration number', value: organisation.registration.trustDeedNumber },
    {
      label: 'Date of registration',
      value: formatRegisteredOn(organisation.registration.registeredOn),
    },
    { label: 'Registered office', value: organisation.addressLine },
    { label: 'PAN', value: organisation.registration.pan },
    { label: 'Section 12A registration', value: organisation.registration.section12A },
    { label: 'Section 80G registration', value: organisation.registration.section80G },
    { label: 'CSR-1 registration', value: organisation.registration.csr1 },
  ].filter((field): field is { label: string; value: string } => Boolean(field.value));
}

export const metadata: Metadata = buildMetadata({
  title: 'About us',
  description:
    'Who we are, how we work, where we work, and how we hold ourselves accountable for what we claim.',
  path: '/about',
});

/*
  ══════════════════════════════════════════════════════════════════════════
  NO FIXED COUNTS ANYWHERE ON THIS PAGE.

  The copy says "multiple districts", never "six"; the map draws whatever
  `impact.reach` holds; the team grid takes however many leaders there are;
  the identifiers list only the fields entered in Admin → Settings. The page
  reads the same with one district or fifty, and nothing here goes stale as the
  organisation grows.

  The focus areas and the approach are descriptions of the work, not records,
  so they are written here rather than fetched.
  ══════════════════════════════════════════════════════════════════════════
*/
type Item = { icon: LucideIcon; tone: string; title: string; body: string };

type FocusAreaItem = {
  icon: LucideIcon;
  discBg: string;
  iconColor: string;
  title: string;
  body: string;
};

const focusAreas: FocusAreaItem[] = [
  {
    icon: BookOpen,
    discBg: 'bg-muted',
    iconColor: 'text-primary',
    title: 'Education',
    body: 'Supporting learning opportunities for brighter futures.',
  },
  {
    icon: HeartPulse,
    discBg: 'bg-info-subtle',
    iconColor: 'text-info',
    title: 'Health',
    body: 'Working towards healthier and stronger communities.',
  },
  {
    icon: Leaf,
    discBg: 'bg-success-subtle',
    iconColor: 'text-success',
    title: 'Livelihoods',
    body: 'Creating opportunities for sustainable income.',
  },
  {
    icon: UsersRound,
    discBg: 'bg-accent',
    iconColor: 'text-primary',
    title: 'Community support',
    body: 'Strengthening local communities and systems.',
  },
];

type ApproachItem = {
  icon: LucideIcon;
  discBg: string;
  iconColor: string;
  title: string;
  body: string;
};

const approach: ApproachItem[] = [
  {
    icon: Users,
    discBg: 'bg-muted',
    iconColor: 'text-primary',
    title: 'Work with what exists',
    body: 'We support schools, health centres and village committees instead of creating parallel systems.',
  },
  {
    icon: ChartNoAxesColumnIncreasing,
    discBg: 'bg-info-subtle',
    iconColor: 'text-info',
    title: 'Measure the outcome',
    body: 'We look at what changes for people, not just the number of activities we conduct.',
  },
  {
    icon: FileText,
    discBg: 'bg-muted',
    iconColor: 'text-primary',
    title: 'Publish what works',
    body: 'We share what has not worked so others can learn from it.',
  },
  {
    icon: MapIcon,
    discBg: 'bg-info-subtle',
    iconColor: 'text-info',
    title: 'Decide locally',
    body: 'Village committees, head teachers and local people help identify the real needs.',
  },
];

export default async function AboutPage() {
  const [team, impact, organisation, records] = await Promise.all([
    getTeam(),
    getImpact(),
    getOrganisation(),
    getOrganisationRecords(),
  ]);
  const registration = registrationFields(organisation);

  /*
    The hero's facts: RECORDS ONLY (`getOrganisationRecords`, never the demo
    fallback the identifiers list below may show in development). Each appears
    when Admin → Settings holds it, in the home page trust section's words;
    with none entered the row is simply absent.
  */
  const heroFacts = [
    records.registration.section12A ? '12A registration' : null,
    records.registration.section80G ? '80G registration' : null,
    records.registration.registeredOn
      ? `Registered ${formatRegisteredOn(records.registration.registeredOn)}`
      : null,
  ].filter((fact): fact is string => Boolean(fact));

  // Every leader, however many there are — the grid wraps.
  const leadership = team.filter((member) => member.department === 'Leadership');
  const regions = impact.reach.byState;

  return (
    <>
      {/* Hero (owner, 2026-11-22: the split hero — words beside the photograph,
          no title baked into the image; AGENTS.md §11 item 25) ---------------- */}
      <InteriorHero
        variant="split"
        id="about-title"
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'About us', path: '/about' },
        ]}
        eyebrow="About us"
        eyebrowIcon={Info}
        title="Real people. Lasting change."
        lead="We work with communities to remove real and practical obstacles in education, health, livelihoods, and social welfare. We focus on what is possible, work with existing systems, and stay accountable for what we create."
        image={{
          src: '/images/about-hero-photo.webp',
          alt: 'A Sailent Foundation coordinator greeting an elderly woman, with villagers and school children around them under a banyan tree',
          position: '62% 35%',
        }}
        actions={
          <Button asChild variant="outline">
            <Link href="/programs">
              See our programs
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        }
        facts={heroFacts}
      />

      {/* Where We Focus -------------------------------------------------------- */}
      <section
        aria-labelledby="focus-areas-heading"
        className="bg-background relative py-8 sm:py-10 lg:py-12"
      >
        <PageShell>
          <div className="mx-auto max-w-2xl text-center">
            <div className="flex items-center justify-center gap-2.5">
              <span className="text-primary text-xs font-bold uppercase tracking-[0.2em] sm:text-sm">
                WHERE WE FOCUS
              </span>
            </div>

            <h2
              id="focus-areas-heading"
              className="font-display text-foreground mt-2.5 text-balance text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-[38px] lg:leading-[1.15]"
            >
              Creating change, together
            </h2>

            <p className="text-muted-foreground mt-2 text-balance text-sm sm:text-base">
              Practical support that helps communities build brighter futures.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-7 lg:grid-cols-4">
            {focusAreas.map((area) => (
              <div
                key={area.title}
                className="card-interactive sm:p-4.5 flex flex-col rounded-[18px] p-4"
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    'mb-3 flex size-10 items-center justify-center rounded-full sm:size-11',
                    area.discBg,
                  )}
                >
                  <area.icon className={cn('size-5', area.iconColor)} strokeWidth={1.8} />
                </div>

                <h3 className="font-display text-foreground text-base font-bold sm:text-lg">
                  {area.title}
                </h3>

                <p className="text-muted-foreground mt-1 text-xs leading-relaxed sm:text-[13.5px]">
                  {area.body}
                </p>
              </div>
            ))}
          </div>
        </PageShell>
      </section>

      {/* Our story ------------------------------------------------------------------ */}
      <section
        aria-labelledby="story-heading"
        className="bg-background border-border/80 relative overflow-hidden border-t py-16 sm:py-20 lg:py-24"
      >
        <PageShell className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-16">
          {/* The collage: one tall photograph on left, two stacked on right */}
          <div className="sm:gap-4.5 grid grid-cols-1 gap-3.5 sm:grid-cols-[1.22fr_1fr] lg:gap-5">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] sm:aspect-auto sm:min-h-0">
              <Image
                src="/images/about-story-hills.webp"
                alt="Children sitting together looking at hills at sunrise"
                fill
                sizes="(max-width: 1024px) 100vw, 550px"
                className="object-cover object-center"
              />
            </div>
            <div className="sm:gap-4.5 grid grid-cols-2 gap-3.5 sm:grid-cols-1 lg:gap-5">
              <div className="relative aspect-[4/2.95] overflow-hidden rounded-[20px]">
                <Image
                  src="/images/campaign-child-nutrition-gaya.webp"
                  alt="Children sharing a meal together"
                  fill
                  sizes="(max-width: 1024px) 50vw, 350px"
                  className="object-cover object-center"
                />
              </div>
              <div className="relative aspect-[4/2.95] overflow-hidden rounded-[20px]">
                <Image
                  src="/images/campaign-greener-communities-bhopal.webp"
                  alt="Hands planting a seedling in fresh soil"
                  fill
                  sizes="(max-width: 1024px) 50vw, 350px"
                  className="object-cover object-center"
                />
              </div>
            </div>
          </div>

          {/* Story content */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-3">
              <span className="text-primary text-xs font-bold uppercase tracking-[0.2em] sm:text-sm">
                OUR STORY
              </span>
            </div>

            <h2
              id="story-heading"
              className="font-display text-foreground mt-3 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-[44px] lg:leading-[1.15]"
            >
              How this <span className="text-primary">started</span>
            </h2>

            <div className="text-muted-foreground mt-5 space-y-4 text-[15px] leading-relaxed sm:text-base sm:leading-[1.68]">
              <p>
                The organization began with a simple question — why do children in these communities
                leave school, even when a school is nearby?
              </p>
              <p>
                As we listened to students, families and teachers, it became clear that the
                challenge was not just one issue, but a mix of attitudes, distance, quality of
                teaching, financial constraints and several other local barriers.
              </p>
              <p>
                We realized that meaningful change does not always require complex solutions. It
                requires honest conversations, practical steps and consistent effort, working with
                the people and institutions that already exist in the community.
              </p>
            </div>

            <div className="mt-8">
              <Link
                href="/programs"
                className="border-primary/30 text-primary hover:bg-primary/5 inline-flex items-center gap-2 rounded-full border-2 px-6 py-2.5 text-sm font-semibold transition-colors duration-200 sm:px-7 sm:py-3 sm:text-base"
              >
                Explore our programs
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </PageShell>
      </section>

      {/* Mission and vision ---------------------------------------------------------- */}
      <section aria-labelledby="purpose-heading" className="bg-surface-tint py-10 md:py-12">
        <PageShell>
          <h2 id="purpose-heading" className="sr-only">
            Our mission and vision
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            <Statement
              icon={Target}
              tone="bg-accent text-primary"
              title="Our mission"
              body="To remove the practical, local obstacles that keep people out of schools, clinics and paid work — by strengthening the institutions already serving them."
            />
            <Statement
              icon={Eye}
              tone="bg-accent text-primary"
              title="Our vision"
              body="Districts where a family’s income does not decide whether a child finishes school, whether an illness is treated, or whether a woman earns."
            />
          </div>
        </PageShell>
      </section>

      {/* How we work ----------------------------------------------------------------- */}
      <section
        aria-labelledby="approach-heading"
        className="bg-background border-border/80 relative border-t py-8 sm:py-10 lg:py-12"
      >
        <PageShell>
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="text-primary text-xs font-bold uppercase tracking-[0.2em] sm:text-sm">
                OUR APPROACH
              </span>
            </div>

            <h2
              id="approach-heading"
              className="font-display text-foreground mt-2.5 text-balance text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-[38px] lg:leading-[1.15]"
            >
              How we <span className="text-primary">work</span>
            </h2>

            <p className="text-muted-foreground mt-2.5 text-balance text-sm sm:text-base">
              We focus on practical solutions, working with existing institutions and the people who
              know their communities best.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-7 lg:grid-cols-4">
            {approach.map((item) => (
              <div
                key={item.title}
                className="card-interactive sm:p-4.5 flex flex-col rounded-[18px] p-4"
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    'mb-3 flex size-10 items-center justify-center rounded-full sm:size-11',
                    item.discBg,
                  )}
                >
                  <item.icon className={cn('size-5', item.iconColor)} strokeWidth={1.8} />
                </div>

                <h3 className="font-display text-foreground text-base font-bold sm:text-lg">
                  {item.title}
                </h3>

                <p className="text-muted-foreground mt-1 text-xs leading-relaxed sm:text-[13.5px]">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </PageShell>
      </section>

      {/* Where we work --------------------------------------------------------------- */}
      <section
        aria-labelledby="presence-heading"
        className="bg-background border-border/80 relative overflow-hidden border-t py-8 sm:py-10 lg:py-12"
      >
        <PageShell className="grid items-center gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8 xl:gap-10">
          {/* Left Column: Copy, Stats & CTA */}
          <div>
            <div className="flex items-center gap-3">
              <span className="text-primary text-xs font-bold uppercase tracking-[0.2em] sm:text-sm">
                WHERE WE WORK
              </span>
            </div>

            <h2
              id="presence-heading"
              className="font-display text-foreground mt-2.5 text-balance text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-[38px] lg:leading-[1.15]"
            >
              Our <span className="text-primary">presence</span>
            </h2>

            <p className="text-muted-foreground mt-2.5 max-w-xl text-balance text-sm sm:text-base">
              We currently work across multiple districts in different states. We add a district
              only when an existing program is running well enough that the field team can take on
              more.
            </p>

            {/* CTA Button */}
            <div className="mt-5">
              <Link
                href="/programs"
                className="border-primary/30 text-primary hover:bg-primary/5 inline-flex items-center gap-2 rounded-full border-2 px-5 py-2 text-sm font-semibold transition-colors duration-200 sm:px-6 sm:py-2.5"
              >
                Explore our programs
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Right Column: India Map with Glowing Pins & Floating Card */}
          <div className="relative mx-auto w-full max-w-[19rem] sm:max-w-[21rem] lg:max-w-[22rem]">
            <IndiaPresenceMap regions={regions} className="w-full" />
            <div className="border-warning/60 bg-muted absolute -bottom-2 right-0 flex items-center gap-2.5 rounded-[18px] border p-2.5 shadow-md sm:bottom-1 sm:right-1 sm:p-3">
              <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-full sm:size-10">
                <MapPin className="size-4.5 text-primary" strokeWidth={2} />
              </div>
              <p className="text-muted-foreground text-[11px] font-medium leading-snug sm:text-xs">
                Working across
                <br />
                multiple regions
                <br />
                in India
              </p>
            </div>
          </div>
        </PageShell>
      </section>

      {/* Who runs it ------------------------------------------------------------------ */}
      {leadership.length > 0 ? (
        <section
          aria-labelledby="team-heading"
          className="bg-background border-border/80 relative border-t py-8 sm:py-10 lg:py-12"
        >
          <PageShell>
            {/* Section Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-primary text-xs font-bold uppercase tracking-[0.2em] sm:text-sm">
                    OUR TEAM
                  </span>
                </div>

                <h2
                  id="team-heading"
                  className="font-display text-foreground mt-2.5 text-balance text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-[38px] lg:leading-[1.15]"
                >
                  Who runs <span className="text-primary">it</span>
                </h2>

                <p className="text-muted-foreground mt-2 text-balance text-sm sm:text-base">
                  A small and committed team working closely with communities, partners and support
                  institutions.
                </p>
              </div>

              <div>
                <Link
                  href="/team"
                  className="border-primary/30 text-primary hover:bg-primary/5 inline-flex items-center gap-2 rounded-full border-2 px-5 py-2 text-sm font-semibold transition-colors duration-200"
                >
                  Meet all team members
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Leadership Cards Grid */}
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:mt-7 lg:grid-cols-3">
              {leadership.map((member) => (
                <div
                  key={member.slug}
                  className="card-interactive group relative flex flex-col overflow-hidden rounded-[18px]"
                >
                  <div className="bg-muted relative aspect-[16/9] w-full overflow-hidden">
                    <Image
                      src={
                        member.photo.url ||
                        (member.name === 'A. Raghavan'
                          ? '/images/team-a-raghavan.webp'
                          : member.name === 'M. Lakshmi'
                            ? '/images/team-m-lakshmi.webp'
                            : member.name === 'S. Deshpande'
                              ? '/images/team-s-deshpande.webp'
                              : `/images/team-${member.slug}.webp`)
                      }
                      alt={member.photo.alt || `Portrait of ${member.name}`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 420px"
                      className="object-cover object-center"
                    />
                  </div>

                  <div className="sm:p-4.5 flex flex-1 flex-col p-4">
                    <h3 className="font-display text-foreground text-base font-bold sm:text-lg">
                      {member.name}
                    </h3>

                    <p className="text-primary mt-0.5 text-xs font-semibold sm:text-[13.5px]">
                      {member.designation}
                    </p>

                    {member.department ? (
                      <p className="text-muted-foreground text-[11px] sm:text-xs">
                        {member.department}
                      </p>
                    ) : null}

                    {member.bio ? (
                      <p className="text-muted-foreground mt-2 line-clamp-2 text-xs leading-relaxed sm:text-[13px]">
                        {member.bio}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </PageShell>
        </section>
      ) : null}

      {/* Trust & Transparency / Check us before you give ---------------------------- */}
      <section
        aria-labelledby="verify-heading"
        className="bg-background border-border/80 relative overflow-hidden border-t py-8 sm:py-10 lg:py-12"
      >
        <PageShell className="grid items-center gap-6 lg:grid-cols-12 lg:gap-8 xl:gap-10">
          {/* Left Column: Heading, description & CTAs */}
          <div className="lg:col-span-5">
            <div className="flex items-center gap-3">
              <span className="text-primary text-xs font-bold uppercase tracking-[0.2em] sm:text-sm">
                TRUST &amp; TRANSPARENCY
              </span>
            </div>

            <h2
              id="verify-heading"
              className="font-display text-foreground mt-2.5 text-balance text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-[38px] lg:leading-[1.15]"
            >
              Check us before you <span className="text-primary">give</span>
            </h2>

            <p className="text-muted-foreground mt-2.5 max-w-md text-balance text-sm sm:text-base">
              These identifiers let you verify us independently against the public registers.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3.5">
              <Link
                href="/donate"
                className="bg-action text-action-foreground hover:bg-action-hover active:bg-action-active inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition-all duration-200 hover:shadow sm:px-6 sm:py-2.5"
              >
                Donate now
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/contact"
                className="border-primary/30 text-primary hover:bg-primary/5 inline-flex items-center justify-center rounded-full border-2 px-5 py-2 text-sm font-semibold transition-colors duration-200 sm:px-6 sm:py-2.5"
              >
                Ask us anything
              </Link>
            </div>
          </div>

          {/* Right Column: Identifiers Card */}
          <div className="lg:col-span-7">
            <div className="card-interactive p-4.5 rounded-[20px] sm:p-5 lg:p-6">
              {registration.length > 0 ? (
                <dl className="divide-border divide-y">
                  {registration.map((field) => (
                    <div
                      key={field.label}
                      className="flex items-center justify-between py-2 first:pt-0 sm:py-2.5"
                    >
                      <dt className="text-muted-foreground text-xs font-medium sm:text-sm">
                        {field.label}
                      </dt>
                      <dd className="text-foreground text-right text-xs font-medium sm:text-sm">
                        {field.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-muted-foreground text-xs sm:text-sm">
                  Our registration details are being added. Ask us for them in the meantime.
                </p>
              )}

              <div className="border-warning/60 bg-muted mt-3.5 flex items-center gap-2.5 rounded-xl border px-3 py-2 sm:mt-4 sm:px-3.5 sm:py-2.5">
                <Info className="sm:size-4.5 text-primary size-4 shrink-0" aria-hidden="true" />
                <p className="text-foreground text-[11px] font-medium sm:text-xs">
                  {organisation.isDemo ? (
                    <>
                      Details shown here are for demonstration: each is a dummy value marked{' '}
                      <span className="font-semibold">DEMO</span>. Actual values will be fetched
                      from admin settings and public records.
                    </>
                  ) : (
                    'Please confirm these identifiers against official records before you give.'
                  )}
                </p>
              </div>
            </div>
          </div>
        </PageShell>
      </section>
    </>
  );
}

function IconDisc({
  icon: Icon,
  tone,
  size = 'md',
}: {
  icon: LucideIcon;
  tone: string;
  size?: 'md' | 'lg';
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-full',
        size === 'lg' ? 'size-16' : 'size-12',
        tone,
      )}
    >
      <Icon className={size === 'lg' ? 'size-7' : 'size-6'} />
    </span>
  );
}

function Statement({ icon, tone, title, body }: Item) {
  // From `sm`: the icon beside a title-and-text column, as before. On a phone
  // the column becomes `contents` in a two-column grid, so the title sits on
  // the icon's row and the text runs full width under both.
  return (
    <div className="border-border/70 bg-surface rounded-2xl border p-6 shadow-sm max-sm:grid max-sm:grid-cols-[auto_minmax(0,1fr)] max-sm:items-center max-sm:gap-x-4 max-sm:gap-y-3 sm:flex sm:items-start sm:gap-6 md:p-8">
      <IconDisc icon={icon} tone={tone} size="lg" />
      <div className="max-sm:contents">
        <h3 className="font-display text-h3 font-bold max-sm:text-[1.375rem]">{title}</h3>
        <p className="text-body-sm text-muted-foreground mt-2 leading-relaxed max-sm:col-span-2 max-sm:mt-0 max-sm:text-[0.9375rem]">
          {body}
        </p>
      </div>
    </div>
  );
}
