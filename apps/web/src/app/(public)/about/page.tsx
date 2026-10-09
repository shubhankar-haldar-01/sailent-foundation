import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BookOpen,
  ChartNoAxesColumnIncreasing,
  CircleAlert,
  Eye,
  FileText,
  HeartPulse,
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
import { MediaFrame } from '@/components/media/media-frame';
import {
  LeafBranch,
  LeafSprig,
  LeafSpray,
  PeopleIcon,
  Rays,
  ScribbleMarks,
  Squiggle,
} from '@/components/about/decor';
import { IndiaPresenceMap } from '@/components/about/india-presence-map';
import { ScriptAccent } from '@/components/sections/script-accent';
import { TeamMemberCard } from '@/components/team/team-member-card';
import { buildMetadata } from '@/lib/seo/metadata';
import { getImpact, getTeam } from '@/lib/content';
import { formatRegisteredOn, getOrganisation, type Organisation } from '@/lib/content/organisation';

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

const focusAreas: Item[] = [
  {
    icon: BookOpen,
    tone: 'bg-wash-amber text-wash-amber-ink',
    title: 'Education',
    body: 'Supporting learning opportunities for brighter futures.',
  },
  {
    icon: HeartPulse,
    tone: 'bg-wash-blue text-wash-blue-ink',
    title: 'Health',
    body: 'Working towards healthier and stronger communities.',
  },
  {
    icon: Leaf,
    tone: 'bg-wash-mint text-wash-mint-ink-strong',
    title: 'Livelihoods',
    body: 'Creating opportunities for sustainable income.',
  },
  {
    icon: UsersRound,
    tone: 'bg-wash-violet text-wash-violet-ink',
    title: 'Community Support',
    body: 'Strengthening local communities and systems.',
  },
];

const approach: Item[] = [
  {
    icon: Users,
    tone: 'bg-wash-amber text-wash-amber-ink',
    title: 'Work with what exists',
    body: 'We support schools, health centres and village committees instead of creating parallel systems.',
  },
  {
    icon: ChartNoAxesColumnIncreasing,
    tone: 'bg-wash-mint text-wash-mint-ink-strong',
    title: 'Measure the outcome',
    body: 'We look at what changes for people, not just the number of activities we conduct.',
  },
  {
    icon: FileText,
    tone: 'bg-wash-violet text-wash-violet-ink',
    title: 'Publish what works',
    body: 'We share what has not worked so others can learn from it.',
  },
  {
    icon: MapIcon,
    tone: 'bg-wash-blue text-wash-blue-ink',
    title: 'Decide locally',
    body: 'Village committees, head teachers and local people help identify the real needs.',
  },
];

/**
 * The story photograph's shape: a rounded rectangle whose lower-left corner is
 * scooped out in a soft curve, leaving room for the handwritten line. Drawn in
 * a 100×100 box and stretched to the frame, so it holds at any size.
 */
const SCOOP_MASK =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'%3E%3Cpath d='M0 0H100V100H62C56 100 52.5 95.5 48 91.7C42 87 33 82 24 82H0Z'/%3E%3C/svg%3E\")";

export default async function AboutPage() {
  const [team, impact, organisation] = await Promise.all([
    getTeam(),
    getImpact(),
    getOrganisation(),
  ]);
  const registration = registrationFields(organisation);

  // Every leader, however many there are — the grid wraps.
  const leadership = team.filter((member) => member.department === 'Leadership');
  const regions = impact.reach.byState;

  return (
    <>
      {/* Hero ---------------------------------------------------------------- */}
      <section aria-labelledby="about-title" className="relative pt-10 md:pt-14">
        {/*
          Matched to the owner's mockup (2026-10-07): a lighter, larger headline
          with natural letter-spacing, larger buttons, and the photograph sitting
          on the buttons' baseline with its decorations around it. The two
          oranges stay at the brand's accessible shade (AA contrast).
        */}
        <PageShell className="grid items-center gap-14 lg:grid-cols-[1fr_1.05fr] lg:items-end lg:gap-16">
          <div>
            <Eyebrow className="font-semibold tracking-[0.2em]">About us</Eyebrow>
            <h1
              id="about-title"
              className="font-display mt-1.5 text-balance text-[clamp(2.125rem,1.55rem+2.4vw,3.3125rem)] font-bold leading-[1.25] tracking-[-0.005em] max-sm:text-[2.25rem] max-sm:leading-[1.18] lg:text-[clamp(2.5rem,0.2rem+3.6vw,3.3125rem)]"
            >
              {/* Three lines from `sm`, as in the design; free to wrap on a phone. */}
              <span className="sm:block">A small organization, </span>
              <span className="sm:block">working narrowly, </span>
              <span className="sm:block">with a big purpose</span>
            </h1>
            <p className="text-body-lg text-muted-foreground mt-5 max-w-[37.5rem] leading-[1.45] max-sm:mt-4 max-sm:text-[0.9375rem] max-sm:leading-[1.6] lg:text-[1.25rem]">
              {/* Four lines on wide screens, broken where the design breaks them. */}
              <span className="min-[85rem]:block">
                We work with communities to remove real and practical{' '}
              </span>
              <span className="min-[85rem]:block">
                obstacles in education, health, livelihoods and social welfare.{' '}
              </span>
              <span className="min-[85rem]:block">
                We focus on what is possible, work with existing systems,{' '}
              </span>
              <span className="min-[85rem]:block">
                and stay accountable for the change we create.
              </span>
            </p>
            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-3 max-sm:mt-6 max-sm:flex-col xl:gap-x-9">
              <Button
                asChild
                size="lg"
                className="lg:h-15 h-14 rounded-full px-8 text-[1.0625rem] max-sm:h-12 max-sm:w-full max-sm:text-base lg:px-9 lg:text-[1.125rem]"
              >
                <Link href="/donate">
                  Donate Now
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                size="lg"
                className="lg:h-15 h-14 rounded-full px-8 text-[1.0625rem] max-sm:h-12 max-sm:w-full max-sm:text-base lg:px-9 lg:text-[1.125rem]"
              >
                <Link href="/programs">Our Programs</Link>
              </Button>
            </div>
          </div>

          <div className="lg:mr-13 relative mx-auto w-full max-w-[35rem] lg:w-[calc(100%-3.25rem)]">
            {/* Soft panels behind the photograph: lavender to the right, pale blue to the left. */}
            <div
              aria-hidden="true"
              className="bg-wash-violet/60 absolute -right-4 bottom-24 top-7 w-1/2 rounded-2xl sm:-right-10"
            />
            <div
              aria-hidden="true"
              className="bg-wash-blue/50 absolute -bottom-1 -left-8 top-1/4 hidden w-1/3 rounded-2xl sm:block"
            />
            <Rays className="text-foreground -top-4.5 w-17 absolute -left-11 h-[5.625rem] max-sm:-left-2 max-sm:-top-6 max-sm:h-14 max-sm:w-10" />
            <LeafSpray className="h-54 absolute -left-[5.75rem] bottom-3 w-auto max-sm:-left-3 max-sm:bottom-6 max-sm:h-28 max-sm:opacity-80" />
            <MediaFrame
              media={{
                seed: 'about-hero',
                url: '/images/campaigns-hero-education.webp',
                alt: 'Schoolchildren in uniform, smiling, at a school the foundation supports',
              }}
              aspect="photo"
              priority
              focus="22% center"
              className="relative aspect-[560/472] rounded-[1.375rem] shadow-[0_18px_40px_-20px_rgb(15_23_42/0.35)] ring-[3px] ring-white/80 dark:ring-white/10"
              sizes="(max-width: 1024px) 100vw, 560px"
            />
            <div className="bg-surface-warm dark:border-border absolute -bottom-14 right-3 w-[14.5rem] rounded-2xl border border-white/70 pb-5 pl-10 pr-6 pt-11 shadow-[0_14px_34px_-14px_rgb(15_23_42/0.22)] max-sm:-bottom-7 max-sm:left-4 max-sm:right-auto max-sm:flex max-sm:w-auto max-sm:max-w-[17rem] max-sm:items-center max-sm:gap-3 max-sm:py-3 max-sm:pl-3 max-sm:pr-5 sm:-bottom-8 sm:-right-6 sm:w-[15.5rem] sm:pb-6 sm:pl-11 sm:pr-8 sm:pt-12 xl:-bottom-5 xl:-right-[4.7rem] xl:w-[17.5rem] xl:pb-7 xl:pl-14 xl:pr-11 xl:pt-14">
              <span
                aria-hidden="true"
                className="bg-wash-amber text-wash-amber-ink size-18 xl:size-22 absolute -top-9 left-4 grid shrink-0 place-items-center rounded-full border-[5px] border-white shadow-sm max-sm:static max-sm:size-14 max-sm:border-[3px] xl:-top-11 xl:left-5"
              >
                <PeopleIcon className="size-8 max-sm:size-6 xl:size-10" />
              </span>
              <p className="text-muted-foreground text-base leading-[1.5] max-sm:text-[0.875rem] max-sm:leading-[1.45] xl:text-[1.0625rem]">
                Focused on people, opportunities and lasting change.
              </p>
            </div>
          </div>
        </PageShell>

        {/* Focus areas, on a soft band with a wave along its top. */}
        <div className="relative mt-20 max-sm:mt-16 md:mt-24">
          <svg
            aria-hidden="true"
            viewBox="0 0 1440 60"
            preserveAspectRatio="none"
            className="fill-surface/70 absolute inset-x-0 -top-[59px] h-[60px] w-full"
          >
            <path d="M0 40 C 240 0, 480 0, 720 26 S 1200 60, 1440 18 V60 H0 Z" />
          </svg>
          <div className="bg-surface/70 pb-14 pt-6">
            <PageShell>
              <h2 className="sr-only">What we work on</h2>
              <ul className="grid gap-8 max-sm:grid-cols-2 max-sm:gap-x-4 max-sm:gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
                {focusAreas.map((area) => (
                  <li
                    key={area.title}
                    className="max-sm:flex max-sm:flex-col max-sm:items-center max-sm:text-center lg:px-6"
                  >
                    <IconDisc icon={area.icon} tone={area.tone} size="lg" />
                    <h3 className="font-display text-h4 mt-4 font-bold max-sm:mt-3 max-sm:text-base">
                      {area.title}
                    </h3>
                    <p className="text-body-sm text-muted-foreground mt-1.5 max-w-[16rem] leading-relaxed max-sm:text-[0.8125rem] max-sm:leading-snug">
                      {area.body}
                    </p>
                  </li>
                ))}
              </ul>
            </PageShell>
          </div>
        </div>
      </section>

      {/* Our story ------------------------------------------------------------------ */}
      <section aria-labelledby="story-heading" className="relative overflow-hidden py-16 md:py-20">
        {/*
          Matched to the owner's mockup (2026-10-07): a wider collage with the
          tall photograph set in from the top and bottom of the stacked pair,
          a larger handwritten line, and bigger type bottom-aligned with the
          photographs.
        */}
        {/* From `xl`: below that the heading reaches into the corner. */}
        <LeafBranch className="h-50 absolute right-2 top-2 hidden w-auto xl:block" />
        {/*
          ON A PHONE the collage and the text interleave, as the mobile design
          has it: heading and first paragraph, the village, the rest of the
          story, the two photographs, then the button. Both columns become
          `contents` below `sm`, so their children are ordered directly in
          this grid; from `sm` up nothing here changes.
        */}
        <PageShell className="min-[90rem]:items-end grid items-center gap-12 max-sm:gap-5 lg:grid-cols-[1.3fr_1fr] lg:gap-[3.8rem]">
          {/* The collage: one tall photograph, two stacked beside it. */}
          <div className="relative grid grid-cols-[1.573fr_1fr] gap-x-3 gap-y-3 max-sm:contents sm:gap-x-3.5 sm:gap-y-[0.9375rem] lg:ml-4">
            <div className="sm:mb-13.5 relative row-span-2 mb-8 mt-2 max-sm:order-3 max-sm:m-0 sm:mt-3.5">
              <div
                aria-hidden="true"
                className="bg-wash-violet/60 absolute -left-6 bottom-[39%] top-[19%] w-10 rounded-l-2xl max-sm:hidden"
              />
              <div
                // The scooped corner only where the handwritten line sits in it.
                className="relative h-full sm:[-webkit-mask-image:var(--scoop)] sm:[mask-image:var(--scoop)] sm:[mask-repeat:no-repeat] sm:[mask-size:100%_100%]"
                style={{ '--scoop': SCOOP_MASK } as React.CSSProperties}
              >
                <MediaFrame
                  media={{
                    seed: 'about-story-village',
                    url: '/images/about-story-hills.webp',
                    alt: 'Hills and fields at sunrise in the region the foundation works in',
                  }}
                  aspect="portrait"
                  focus="center 60%"
                  className="aspect-auto h-full min-h-56 rounded-[1.25rem] max-sm:aspect-[16/10] max-sm:h-auto max-sm:min-h-0"
                  sizes="(max-width: 1024px) 60vw, 432px"
                />
              </div>
              <div className="absolute -bottom-7 left-0 origin-bottom-left -rotate-[8deg] max-sm:hidden sm:-bottom-6">
                <ScriptAccent className="block text-[1.5rem] leading-[0.86] text-[oklch(0.47_0.045_230)] sm:text-[2.125rem] lg:text-[1.625rem] xl:text-[2.125rem] dark:text-[oklch(0.82_0.05_225)]">
                  <span className="block">Stronger</span>
                  <span className="block">communities,</span>
                  <span className="block">brighter futures</span>
                </ScriptAccent>
                <ScribbleMarks className="text-cta-glow/55 absolute -bottom-2 -right-8 h-auto w-12 sm:-right-9 sm:w-14 lg:-right-7 lg:w-11 xl:-right-9 xl:w-14" />
              </div>
            </div>
            <MediaFrame
              media={{
                seed: 'about-story-children',
                url: '/images/campaign-child-nutrition-gaya.webp',
                alt: 'Children sitting together at a community centre',
              }}
              aspect="square"
              className="aspect-[274/285] rounded-[1.125rem] shadow-sm max-sm:order-5 max-sm:aspect-[16/9]"
              sizes="(max-width: 1024px) 40vw, 274px"
            />
            <MediaFrame
              media={{
                seed: 'about-story-planting',
                url: '/images/campaign-greener-communities-bhopal.webp',
                alt: 'Hands planting a seedling in fresh soil',
              }}
              aspect="square"
              className="aspect-[274/285] rounded-[1.125rem] shadow-sm max-sm:order-6 max-sm:aspect-[16/9]"
              sizes="(max-width: 1024px) 40vw, 274px"
            />
          </div>

          <div className="max-sm:contents">
            <div className="max-sm:order-1">
              <Eyebrow className="text-[0.9375rem] font-semibold tracking-[0.17em] max-sm:text-[0.8125rem]">
                Our story
              </Eyebrow>
              <h2
                id="story-heading"
                className="font-display mt-1.5 text-[clamp(2rem,1.5rem+1.85vw,2.8125rem)] font-bold leading-[1.15] tracking-[-0.005em]"
              >
                How this started
              </h2>
            </div>
            <p className="text-body-lg text-muted-foreground mt-4.5 max-w-[35rem] leading-[1.58] max-sm:order-2 max-sm:-mt-2 max-sm:text-[0.9375rem] lg:text-[1.1875rem]">
              The organization began with a simple question — why do children in these communities
              leave school, even when a school is nearby?
            </p>
            <div className="text-body-lg text-muted-foreground mt-5 max-w-[35rem] space-y-5 leading-[1.58] max-sm:order-4 max-sm:mt-0 max-sm:space-y-4 max-sm:text-[0.9375rem] lg:text-[1.1875rem]">
              <p>
                As we listened to students, families and teachers, it became clear that the
                challenge was not just one issue, but a mix of attitudes, distance, quality of
                teaching, financial constraints and several other local barriers.
              </p>
              <p>
                We realized that meaningful change does not always require complex solutions. It
                requires honest conversations,
                {/* The design breaks here; only where the column is wide enough to match it. */}
                <br className="min-[90rem]:inline hidden" /> practical steps and consistent effort,
                working with the people and institutions that already exist in the community.
              </p>
            </div>
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="mt-7 h-14 rounded-full px-8 text-[1.0625rem] max-sm:order-7 max-sm:mt-2 max-sm:h-12 max-sm:justify-self-center max-sm:text-base lg:h-16 lg:px-[2.125rem] lg:text-[1.125rem]"
            >
              <Link href="/impact">
                Our Journey
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
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
              tone="bg-wash-rose text-wash-rose-ink"
              title="Our Mission"
              body="To remove the practical, local obstacles that keep people out of schools, clinics and paid work — by strengthening the institutions already serving them."
            />
            <Statement
              icon={Eye}
              tone="bg-wash-blue text-wash-blue-ink"
              title="Our Vision"
              body="Districts where a family’s income does not decide whether a child finishes school, whether an illness is treated, or whether a woman earns."
            />
          </div>
        </PageShell>
      </section>

      {/* How we work ----------------------------------------------------------------- */}
      <section
        aria-labelledby="approach-heading"
        className="relative overflow-hidden py-16 md:py-20"
      >
        <Squiggle className="absolute right-4 top-14 hidden w-56 lg:block xl:right-16" />
        <PageShell>
          <Eyebrow>Our approach</Eyebrow>
          <h2 id="approach-heading" className="font-display text-h1 mt-2 font-bold tracking-tight">
            How we work
          </h2>
          <p className="text-body-lg text-muted-foreground mt-3 max-w-3xl leading-relaxed">
            We focus on practical solutions, working with existing institutions and the people who
            know their communities best.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {approach.map((item) => (
              <li
                key={item.title}
                className="border-border/70 bg-surface rounded-2xl border p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <IconDisc icon={item.icon} tone={item.tone} />
                <h3 className="text-body-lg font-display mt-4 font-bold">{item.title}</h3>
                <p className="text-body-sm text-muted-foreground mt-1.5 leading-relaxed">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </PageShell>
      </section>

      {/* Where we work --------------------------------------------------------------- */}
      <section
        aria-labelledby="presence-heading"
        className="bg-surface-tint/70 relative overflow-hidden max-sm:flex max-sm:flex-col lg:min-h-[30rem]"
      >
        {/*
          Matched to the owner's mockup (2026-10-07): a wider photograph
          fading into the band, larger type, and a taller map running almost
          the full height with the card overlapping its south-east.
        */}
        {/* The photograph, full-bleed on the left and fading into the band. */}
        {/* On a phone: after the map and the button, as a rounded photograph. */}
        <div className="relative max-sm:order-2 max-sm:px-4 lg:absolute lg:inset-y-0 lg:left-0 lg:w-[40%]">
          <div className="h-full [mask-image:linear-gradient(to_bottom,black_75%,transparent)] max-sm:overflow-hidden max-sm:rounded-2xl max-sm:shadow-sm max-sm:[mask-image:none] lg:[mask-image:linear-gradient(to_right,black_70%,transparent)]">
            <MediaFrame
              media={{
                seed: 'about-presence',
                url: '/images/about-presence-walk.webp',
                alt: 'Schoolchildren with backpacks looking out over their village at sunset',
              }}
              aspect="landscape"
              rounded={false}
              focus="30% center"
              className="aspect-[16/10] max-sm:aspect-[6/5] lg:aspect-auto lg:h-full"
              sizes="(max-width: 1024px) 100vw, 610px"
            />
          </div>
          <LeafBranch className="absolute -bottom-10 -right-2 hidden h-40 w-auto rotate-[25deg] -scale-x-100 lg:block" />
        </div>

        <PageShell className="relative grid items-center gap-10 py-12 max-sm:order-1 max-sm:gap-0 max-sm:pb-8 lg:grid-cols-[36%_1fr_15rem] lg:gap-0 lg:py-16 xl:grid-cols-[36%_1fr_19rem]">
          <div aria-hidden="true" className="hidden lg:block" />
          <div className="max-sm:contents lg:ml-8 lg:mr-2 xl:mt-6">
            <Eyebrow className="text-[0.9375rem] font-semibold tracking-[0.18em]">
              Where we work
            </Eyebrow>
            <h2
              id="presence-heading"
              className="font-display mt-1.5 text-[clamp(1.875rem,1.4rem+1.6vw,2.5rem)] font-bold leading-[1.2] tracking-[-0.005em]"
            >
              Our presence
            </h2>
            <p className="text-body-lg text-muted-foreground min-[90rem]:max-w-none mt-2.5 max-w-xl leading-[1.45]">
              {/* Three lines on wide screens, broken where the design breaks them. */}
              <span className="min-[90rem]:block">
                We currently work across multiple districts in different{' '}
              </span>
              <span className="min-[90rem]:block">
                states. We add a district only when an existing program{' '}
              </span>
              <span className="min-[90rem]:block">
                is running well enough that the field team can take on more.
              </span>
            </p>
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="xl:h-15 mt-7 h-14 rounded-full px-8 text-[1.0625rem] max-sm:order-last max-sm:mt-12 max-sm:h-12 max-sm:w-full max-sm:text-base xl:text-[1.125rem]"
            >
              <Link href="/programs">
                Explore our programs
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <div className="relative mx-auto w-full max-w-sm max-sm:mt-6 lg:-mt-9 lg:self-start xl:-mt-9">
            <IndiaPresenceMap regions={regions} className="w-[88%] lg:w-full xl:w-[19.75rem]" />
            <div className="bg-surface-warm absolute -right-2 bottom-2 flex max-w-[12.5rem] items-center gap-3 rounded-2xl p-4 shadow-[0_10px_30px_-14px_rgb(15_23_42/0.2)] sm:-right-6 lg:-bottom-14 xl:bottom-auto xl:left-[5.3rem] xl:right-auto xl:top-[15.375rem] xl:w-[16.25rem] xl:max-w-none xl:gap-[1.125rem] xl:py-[2.0625rem] xl:pl-[2.125rem] xl:pr-8">
              <MapPin
                className="text-cta-glow xl:size-15 size-8 shrink-0"
                strokeWidth={1.6}
                aria-hidden="true"
              />
              <p className="text-body-sm text-muted-foreground leading-snug xl:text-[0.9375rem] xl:leading-[1.5]">
                Working across multiple regions in India
              </p>
            </div>
          </div>
        </PageShell>

        {/* Phone only: the handwritten line under the photograph, as designed. */}
        <div className="order-3 flex items-center gap-4 px-6 pb-12 pt-6 sm:hidden">
          <span
            aria-hidden="true"
            className="bg-wash-mint text-wash-mint-ink-strong grid size-14 shrink-0 place-items-center rounded-full"
          >
            <Leaf className="size-7" />
          </span>
          <ScriptAccent className="block text-[1.625rem] leading-[0.95] text-[oklch(0.47_0.045_230)] dark:text-[oklch(0.82_0.05_225)]">
            <span className="block">“Stronger</span>
            <span className="block">communities</span>
            <span className="block">brighter futures”</span>
          </ScriptAccent>
        </div>
      </section>

      {/* Who runs it ------------------------------------------------------------------ */}
      {leadership.length > 0 ? (
        <section aria-labelledby="team-heading" className="py-16 md:py-20">
          <PageShell>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Eyebrow>Our team</Eyebrow>
                <h2
                  id="team-heading"
                  className="font-display text-h1 mt-2 font-bold tracking-tight"
                >
                  Who runs it
                </h2>
                <p className="text-body-lg text-muted-foreground mt-3 leading-relaxed">
                  A small and committed team working closely with communities, partners and support
                  institutions.
                </p>
              </div>
              <Button asChild variant="secondary" className="rounded-full max-sm:hidden">
                <Link href="/team">
                  Full team and board
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {leadership.map((member) => (
                <li key={member.slug}>
                  <TeamMemberCard member={member} layout="card" />
                </li>
              ))}
            </ul>
            {/* On a phone the link closes the list instead of heading it. */}
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="mt-6 h-12 w-full rounded-full sm:hidden"
            >
              <Link href="/team">
                Full team and board
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </PageShell>
        </section>
      ) : null}

      {/* Check us before you give ----------------------------------------------------- */}
      <section
        aria-labelledby="verify-heading"
        className="bg-surface-tint/60 relative overflow-hidden py-16 md:py-20"
      >
        <LeafSprig className="absolute -bottom-4 -left-4 hidden h-40 w-auto lg:block" />
        {/*
          REGISTRATION LIVES HERE, not on a page of its own.

          There was a `/transparency` page carrying these identifiers plus
          document lists. It is gone — documents are admin-only — but the
          identifiers could not go with it: a donor claiming relief under
          Section 80G needs the registration number, and "verify us against
          the public register" is the single most useful thing an NGO site can
          offer someone deciding whether to give.
        */}
        <PageShell className="relative grid items-center gap-10 max-sm:gap-0 lg:grid-cols-12 lg:gap-12">
          {/* On a phone the buttons follow the list (`contents` + `order`). */}
          <div className="max-sm:contents lg:col-span-5">
            <Eyebrow>Trust &amp; transparency</Eyebrow>
            <h2
              id="verify-heading"
              className="font-display text-h1 mt-2 text-balance font-bold tracking-tight"
            >
              Check us before you give
            </h2>
            <p className="text-body-lg text-muted-foreground mt-3 max-w-md leading-relaxed">
              These identifiers let you verify us independently against the public registers.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 max-sm:order-last max-sm:mt-6 max-sm:flex-col">
              {/* Not on a phone (owner request, 2026-10-07): there it leaves
                  "Ask us anything" as the section's one action. */}
              <Button asChild size="lg" className="rounded-full max-sm:hidden">
                <Link href="/donate">
                  Donate Now
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                size="lg"
                className="rounded-full max-sm:h-12 max-sm:w-full"
              >
                <Link href="/contact">Ask us anything</Link>
              </Button>
            </div>
          </div>

          <div className="border-border/70 bg-surface rounded-2xl border p-5 shadow-sm max-sm:mt-6 max-sm:p-4 sm:p-6 lg:col-span-7">
            {registration.length > 0 ? (
              <dl className="divide-border/70 divide-y">
                {registration.map((field) => (
                  <div
                    key={field.label}
                    className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2 first:pt-0 max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)] max-sm:gap-x-3"
                  >
                    <dt className="text-body-sm text-muted-foreground max-sm:text-[0.8125rem]">
                      {field.label}
                    </dt>
                    <dd
                      data-numeric=""
                      className="text-body-sm text-foreground text-right max-sm:break-words max-sm:text-left max-sm:text-[0.8125rem]"
                    >
                      {field.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-body-sm text-muted-foreground">
                Our registration details are being added. Ask us for them in the meantime.
              </p>
            )}
            {organisation.isDemo ? (
              <p className="bg-warning-subtle text-caption text-warning-foreground mt-5 flex items-start gap-3 rounded-xl p-4">
                <CircleAlert className="text-cta-glow size-6 shrink-0" aria-hidden="true" />
                <span>
                  Details shown here are for demonstration: each is a dummy value marked{' '}
                  <span className="font-semibold">DEMO</span>. Actual values will be fetched from
                  admin settings and public records.
                </span>
              </p>
            ) : null}
          </div>
        </PageShell>
      </section>
    </>
  );
}

/** The small orange label over a section heading. Not a heading itself. */
function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-caption text-primary font-bold uppercase tracking-[0.1em]', className)}>
      {children}
    </p>
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
