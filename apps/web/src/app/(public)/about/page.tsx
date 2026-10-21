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
    discBg: 'bg-[#FEEFE6] dark:bg-orange-950/60',
    iconColor: 'text-primary dark:text-[#F97316]',
    title: 'Education',
    body: 'Supporting learning opportunities for brighter futures.',
  },
  {
    icon: HeartPulse,
    discBg: 'bg-[#E0F2FE] dark:bg-sky-950/60',
    iconColor: 'text-[#0284C7] dark:text-[#38BDF8]',
    title: 'Health',
    body: 'Working towards healthier and stronger communities.',
  },
  {
    icon: Leaf,
    discBg: 'bg-[#DCFCE7] dark:bg-emerald-950/60',
    iconColor: 'text-[#16A34A] dark:text-[#4ADE80]',
    title: 'Livelihoods',
    body: 'Creating opportunities for sustainable income.',
  },
  {
    icon: UsersRound,
    discBg: 'bg-[#F3E8FF] dark:bg-purple-950/60',
    iconColor: 'text-[#9333EA] dark:text-[#C084FC]',
    title: 'Community Support',
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
    discBg: 'bg-[#FEEFE6] dark:bg-orange-950/60',
    iconColor: 'text-primary dark:text-[#F97316]',
    title: 'Work with what exists',
    body: 'We support schools, health centres and village committees instead of creating parallel systems.',
  },
  {
    icon: ChartNoAxesColumnIncreasing,
    discBg: 'bg-[#E0F2FE] dark:bg-sky-950/60',
    iconColor: 'text-[#0284C7] dark:text-[#38BDF8]',
    title: 'Measure the outcome',
    body: 'We look at what changes for people, not just the number of activities we conduct.',
  },
  {
    icon: FileText,
    discBg: 'bg-[#FEEFE6] dark:bg-orange-950/60',
    iconColor: 'text-primary dark:text-[#F97316]',
    title: 'Publish what works',
    body: 'We share what has not worked so others can learn from it.',
  },
  {
    icon: MapIcon,
    discBg: 'bg-[#E0F2FE] dark:bg-sky-950/60',
    iconColor: 'text-[#0284C7] dark:text-[#38BDF8]',
    title: 'Decide locally',
    body: 'Village committees, head teachers and local people help identify the real needs.',
  },
];

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
      <section
        aria-labelledby="about-title"
        className="relative overflow-hidden bg-gradient-to-b from-[#F2F8FD] via-[#EEF6FC] to-[#E6F1FA] pb-16 pt-12 md:pb-20 md:pt-16 lg:pb-24 lg:pt-20 dark:from-[#0B1B2B] dark:via-[#0E2235] dark:to-[#0A1724]"
      >
        <PageShell className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14 xl:gap-16">
          <div className="max-w-xl">
            <div className="flex items-center gap-3">
              <span className="text-primary text-xs font-bold uppercase tracking-[0.2em] sm:text-sm">
                ABOUT SAILENT FOUNDATION
              </span>
              <span className="h-[1.5px] w-8 bg-[#EB6A1F]" aria-hidden="true" />
            </div>

            <h1
              id="about-title"
              className="font-display mt-3 text-balance text-4xl font-bold leading-[1.12] tracking-tight text-[#102A43] sm:text-5xl lg:text-[3.5rem] xl:text-[3.75rem] dark:text-white"
            >
              <span className="block">Real People.</span>
              <span className="text-primary block">Lasting Change.</span>
            </h1>

            <p className="mt-5 text-base leading-[1.65] text-[#486581] sm:text-[1.0625rem] lg:text-[1.125rem] dark:text-slate-300">
              We work with communities to remove real and practical obstacles in education, health,
              livelihoods and social welfare. We focus on what is possible, work with existing
              systems, and stay accountable for the change we create.
            </p>

            <div className="mt-7 flex flex-col gap-3.5 sm:mt-8 sm:flex-row sm:items-center sm:gap-4">
              <Button
                asChild
                size="lg"
                className="text-primary-foreground hover:bg-primary-hover h-12 w-full rounded-full bg-[#EB6A1F] px-7 text-base font-semibold shadow-md shadow-[#EB6A1F]/25 transition-all duration-200 hover:shadow-lg hover:shadow-[#EB6A1F]/35 sm:w-auto sm:px-8"
              >
                <Link
                  href="/donate"
                  className="inline-flex w-full items-center justify-center gap-2 sm:w-auto"
                >
                  Donate Now
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                size="lg"
                className="h-12 w-full rounded-full border-2 border-[#0070BA] bg-white px-7 text-base font-semibold text-[#0070BA] shadow-none transition-all duration-200 hover:bg-[#0070BA]/5 sm:w-auto sm:px-8 dark:border-sky-400 dark:bg-slate-900 dark:text-sky-400 dark:hover:bg-sky-400/10"
              >
                <Link
                  href="/programs"
                  className="inline-flex w-full items-center justify-center gap-2 sm:w-auto"
                >
                  Explore Our Programs
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[34rem] lg:max-w-none">
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[24px] shadow-xl shadow-[#102A43]/10 ring-1 ring-black/5 sm:rounded-[32px] dark:ring-white/10">
              <Image
                src="/images/about-hero.webp"
                alt="Sailent Foundation field team coordinator and volunteers smiling warmly with rural villagers and school children under a banyan tree"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, (max-width: 1280px) 50vw, 600px"
                className="object-cover object-center"
              />
            </div>
          </div>
        </PageShell>
      </section>

      {/* Where We Focus -------------------------------------------------------- */}
      <section
        aria-labelledby="focus-areas-heading"
        className="bg-background relative py-8 sm:py-10 lg:py-12"
      >
        <PageShell>
          <div className="mx-auto max-w-2xl text-center">
            <div className="flex items-center justify-center gap-2.5">
              <span className="h-[1.5px] w-6 bg-[#EB6A1F]" aria-hidden="true" />
              <span className="text-primary text-xs font-bold uppercase tracking-[0.2em] sm:text-sm">
                WHERE WE FOCUS
              </span>
              <span className="h-[1.5px] w-6 bg-[#EB6A1F]" aria-hidden="true" />
            </div>

            <h2
              id="focus-areas-heading"
              className="font-display mt-2.5 text-balance text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl lg:text-[38px] lg:leading-[1.15] dark:text-white"
            >
              Creating Change, <span className="text-primary">Together</span>
            </h2>

            <p className="mt-2 text-balance text-sm text-[#64748B] sm:text-base dark:text-slate-400">
              Practical support that helps communities build brighter futures.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-7 lg:grid-cols-4">
            {focusAreas.map((area) => (
              <div
                key={area.title}
                className="sm:p-4.5 flex flex-col rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-shadow duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
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

                <h3 className="font-display text-base font-bold text-[#0F172A] sm:text-lg dark:text-white">
                  {area.title}
                </h3>

                <p className="mt-1 text-xs leading-relaxed text-[#64748B] sm:text-[13.5px] dark:text-slate-400">
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
        className="bg-background relative overflow-hidden border-t border-slate-200/80 py-16 sm:py-20 lg:py-24 dark:border-slate-800"
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
              <span className="h-[1.5px] w-8 bg-[#EB6A1F]" aria-hidden="true" />
            </div>

            <h2
              id="story-heading"
              className="font-display mt-3 text-balance text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl lg:text-[44px] lg:leading-[1.15] dark:text-white"
            >
              How this <span className="text-primary">started</span>
            </h2>

            <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-[#475569] sm:text-base sm:leading-[1.68] dark:text-slate-300">
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
                href="/impact"
                className="inline-flex items-center gap-2 rounded-full border-2 border-[#0070BA] px-6 py-2.5 text-sm font-semibold text-[#0070BA] transition-colors duration-200 hover:bg-[#0070BA]/5 sm:px-7 sm:py-3 sm:text-base dark:border-sky-400 dark:text-sky-400 dark:hover:bg-sky-400/10"
              >
                Our Journey
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
        className="bg-background relative border-t border-slate-200/80 py-8 sm:py-10 lg:py-12 dark:border-slate-800"
      >
        <PageShell>
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="text-primary text-xs font-bold uppercase tracking-[0.2em] sm:text-sm">
                OUR APPROACH
              </span>
              <span className="h-[1.5px] w-8 bg-[#EB6A1F]" aria-hidden="true" />
            </div>

            <h2
              id="approach-heading"
              className="font-display mt-2.5 text-balance text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl lg:text-[38px] lg:leading-[1.15] dark:text-white"
            >
              How we <span className="text-primary">work</span>
            </h2>

            <p className="mt-2.5 text-balance text-sm text-[#64748B] sm:text-base dark:text-slate-400">
              We focus on practical solutions, working with existing institutions and the people who
              know their communities best.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-7 lg:grid-cols-4">
            {approach.map((item) => (
              <div
                key={item.title}
                className="sm:p-4.5 flex flex-col rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-shadow duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
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

                <h3 className="font-display text-base font-bold text-[#0F172A] sm:text-lg dark:text-white">
                  {item.title}
                </h3>

                <p className="mt-1 text-xs leading-relaxed text-[#64748B] sm:text-[13.5px] dark:text-slate-400">
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
        className="bg-background relative overflow-hidden border-t border-slate-200/80 py-8 sm:py-10 lg:py-12 dark:border-slate-800"
      >
        <PageShell className="grid items-center gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8 xl:gap-10">
          {/* Left Column: Copy, Stats & CTA */}
          <div>
            <div className="flex items-center gap-3">
              <span className="text-primary text-xs font-bold uppercase tracking-[0.2em] sm:text-sm">
                WHERE WE WORK
              </span>
              <span className="h-[1.5px] w-8 bg-[#EB6A1F]" aria-hidden="true" />
            </div>

            <h2
              id="presence-heading"
              className="font-display mt-2.5 text-balance text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl lg:text-[38px] lg:leading-[1.15] dark:text-white"
            >
              Our <span className="text-primary">presence</span>
            </h2>

            <p className="mt-2.5 max-w-xl text-balance text-sm text-[#64748B] sm:text-base dark:text-slate-400">
              We currently work across multiple districts in different states. We add a district
              only when an existing program is running well enough that the field team can take on
              more.
            </p>

            {/* CTA Button */}
            <div className="mt-5">
              <Link
                href="/programs"
                className="inline-flex items-center gap-2 rounded-full border-2 border-[#0070BA] px-5 py-2 text-sm font-semibold text-[#0070BA] transition-colors duration-200 hover:bg-[#0070BA]/5 sm:px-6 sm:py-2.5 dark:border-sky-400 dark:text-sky-400 dark:hover:bg-sky-400/10"
              >
                Explore our programs
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Right Column: India Map with Glowing Pins & Floating Card */}
          <div className="relative mx-auto w-full max-w-[19rem] sm:max-w-[21rem] lg:max-w-[22rem]">
            <IndiaPresenceMap regions={regions} className="w-full" />
            <div className="absolute -bottom-2 right-0 flex items-center gap-2.5 rounded-[18px] border border-amber-200/60 bg-[#FFF9F2] p-2.5 shadow-md sm:bottom-1 sm:right-1 sm:p-3 dark:border-amber-900/40 dark:bg-slate-900">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#FEE7D6] sm:size-10 dark:bg-orange-950/60">
                <MapPin className="size-4.5 text-[#EB6A1F]" strokeWidth={2} />
              </div>
              <p className="text-[11px] font-medium leading-snug text-[#475569] sm:text-xs dark:text-slate-300">
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
          className="bg-background relative border-t border-slate-200/80 py-8 sm:py-10 lg:py-12 dark:border-slate-800"
        >
          <PageShell>
            {/* Section Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-primary text-xs font-bold uppercase tracking-[0.2em] sm:text-sm">
                    OUR TEAM
                  </span>
                  <span className="h-[1.5px] w-8 bg-[#EB6A1F]" aria-hidden="true" />
                </div>

                <h2
                  id="team-heading"
                  className="font-display mt-2.5 text-balance text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl lg:text-[38px] lg:leading-[1.15] dark:text-white"
                >
                  Who runs <span className="text-primary">it</span>
                </h2>

                <p className="mt-2 text-balance text-sm text-[#64748B] sm:text-base dark:text-slate-400">
                  A small and committed team working closely with communities, partners and support
                  institutions.
                </p>
              </div>

              <div>
                <Link
                  href="/team"
                  className="inline-flex items-center gap-2 rounded-full border-2 border-[#0070BA] px-5 py-2 text-sm font-semibold text-[#0070BA] transition-colors duration-200 hover:bg-[#0070BA]/5 dark:border-sky-400 dark:text-sky-400 dark:hover:bg-sky-400/10"
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
                  className="group relative flex flex-col overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-shadow duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
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
                    <h3 className="font-display text-base font-bold text-[#0F172A] sm:text-lg dark:text-white">
                      {member.name}
                    </h3>

                    <p className="text-primary mt-0.5 text-xs font-semibold sm:text-[13.5px]">
                      {member.designation}
                    </p>

                    {member.department ? (
                      <p className="text-[11px] text-[#64748B] sm:text-xs dark:text-slate-400">
                        {member.department}
                      </p>
                    ) : null}

                    {member.bio ? (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#64748B] sm:text-[13px] dark:text-slate-400">
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
        className="bg-background relative overflow-hidden border-t border-slate-200/80 py-8 sm:py-10 lg:py-12 dark:border-slate-800"
      >
        <PageShell className="grid items-center gap-6 lg:grid-cols-12 lg:gap-8 xl:gap-10">
          {/* Left Column: Heading, description & CTAs */}
          <div className="lg:col-span-5">
            <div className="flex items-center gap-3">
              <span className="text-primary text-xs font-bold uppercase tracking-[0.2em] sm:text-sm">
                TRUST &amp; TRANSPARENCY
              </span>
              <span className="h-[1.5px] w-8 bg-[#EB6A1F]" aria-hidden="true" />
            </div>

            <h2
              id="verify-heading"
              className="font-display mt-2.5 text-balance text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl lg:text-[38px] lg:leading-[1.15] dark:text-white"
            >
              Check us before you <span className="text-primary">give</span>
            </h2>

            <p className="mt-2.5 max-w-md text-balance text-sm text-[#64748B] sm:text-base dark:text-slate-400">
              These identifiers let you verify us independently against the public registers.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3.5">
              <Link
                href="/donate"
                className="text-primary-foreground hover:bg-primary-hover inline-flex items-center justify-center gap-2 rounded-full bg-[#EB6A1F] px-5 py-2 text-sm font-semibold shadow-sm transition-all duration-200 hover:shadow sm:px-6 sm:py-2.5"
              >
                Donate Now
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-full border-2 border-[#0070BA] px-5 py-2 text-sm font-semibold text-[#0070BA] transition-colors duration-200 hover:bg-[#0070BA]/5 sm:px-6 sm:py-2.5 dark:border-sky-400 dark:text-sky-400 dark:hover:bg-sky-400/10"
              >
                Ask us anything
              </Link>
            </div>
          </div>

          {/* Right Column: Identifiers Card */}
          <div className="lg:col-span-7">
            <div className="p-4.5 rounded-[20px] border border-slate-200/80 bg-white shadow-[0_2px_15px_rgba(0,0,0,0.02)] sm:p-5 lg:p-6 dark:border-slate-800 dark:bg-slate-900">
              {registration.length > 0 ? (
                <dl className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {registration.map((field) => (
                    <div
                      key={field.label}
                      className="flex items-center justify-between py-2 first:pt-0 sm:py-2.5"
                    >
                      <dt className="text-xs font-medium text-[#475569] sm:text-sm dark:text-slate-300">
                        {field.label}
                      </dt>
                      <dd className="text-right text-xs font-medium text-[#0F172A] sm:text-sm dark:text-white">
                        {field.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-xs text-[#475569] sm:text-sm dark:text-slate-300">
                  Our registration details are being added. Ask us for them in the meantime.
                </p>
              )}

              <div className="mt-3.5 flex items-center gap-2.5 rounded-xl border border-amber-200/60 bg-[#FFF7EE] px-3 py-2 sm:mt-4 sm:px-3.5 sm:py-2.5 dark:border-amber-900/40 dark:bg-amber-950/30">
                <Info className="sm:size-4.5 size-4 shrink-0 text-[#EB6A1F]" aria-hidden="true" />
                <p className="text-[11px] font-medium text-[#334155] sm:text-xs dark:text-slate-300">
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
