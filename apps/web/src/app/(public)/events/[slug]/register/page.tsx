import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { EventRegistrationFlow } from '@/components/events/event-registration-flow';
import { EventSummaryCard } from '@/components/events/event-summary-card';
import { cardAction } from '@/components/events/events-query';
import { currentDonor } from '@/lib/auth/donor-session';
import { getEvent, getProgram } from '@/lib/content';
import { getOrganisation } from '@/lib/content/organisation';
import { donorFetch, type DonorProfile } from '@/lib/donor/api';
import { buildMetadata, canonicalUrl } from '@/lib/seo/metadata';

interface MyRegistration {
  id: string;
  status: 'registered' | 'confirmed' | 'attended' | 'no_show' | 'cancelled' | 'waitlisted';
  attendeeCount: number;
  meetingUrl: string | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const event = await getEvent((await params).slug);
  if (!event) return buildMetadata({ title: 'Event not found', path: '/events', noIndex: true });

  return buildMetadata({
    title: `Register for ${event.title}`,
    description: event.summary || `Join ${event.title} organized by Sailent Foundation.`,
    path: `/events/${event.slug}/register`,
  });
}

export default async function EventRegisterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  // Load program for category
  const program = event.programSlug ? await getProgram(event.programSlug).catch(() => null) : null;
  // An event without a programme has no category, as on its card: nothing is invented.
  const categoryName = program?.category || program?.name || null;
  // The shared rule, as the card on /events and the API apply it.
  const action = cardAction(event);

  // Load donor session & profile if signed in
  const donor = await currentDonor();
  let profile: DonorProfile | null = null;
  let myReg: MyRegistration | null = null;

  if (donor) {
    try {
      profile = await donorFetch<DonorProfile>('me');
    } catch {
      profile = null;
    }

    if (event.id) {
      try {
        myReg = await donorFetch<MyRegistration>(`events/${event.id}/registration`);
      } catch {
        myReg = null;
      }
    }
  }

  const isRegistered = myReg !== null && myReg.status !== 'cancelled';
  const seatsLeft =
    event.capacity === null ? null : Math.max(0, event.capacity - event.registeredCount);

  // Load organization for contact details
  const organisation = await getOrganisation();
  // The organisation's own contact details, and nothing in their place.
  const supportEmail = organisation.email;
  const supportPhone = organisation.phoneDisplay;
  const supportPhoneHref = organisation.phoneHref ? `tel:${organisation.phoneHref}` : null;

  const initialProfile = profile
    ? {
        fullName: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || undefined,
        email: profile.email || undefined,
        phone: profile.phone || undefined,
      }
    : null;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#F8FAFC]">
      {/* Ambient decorative soft cyan/sky glow in background matching reference */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem] overflow-hidden">
        <div className="absolute -left-24 -top-24 size-[34rem] rounded-full bg-sky-100/50 blur-3xl" />
        <div className="absolute -right-24 top-8 size-[30rem] rounded-full bg-sky-50/60 blur-3xl" />
      </div>

      <h1 className="sr-only">Register for {event.title}</h1>

      {/* 1. Breadcrumb bar matching final design */}
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link href="/" className="hover:text-primary transition-colors">
            Home
          </Link>
          <span className="text-slate-400">&gt;</span>
          <Link href="/events" className="hover:text-primary transition-colors">
            Events
          </Link>
          <span className="text-slate-400">&gt;</span>
          <Link href={`/events/${event.slug}`} className="hover:text-primary transition-colors">
            {event.title}
          </Link>
          <span className="text-slate-400">&gt;</span>
          <span aria-current="page" className="font-semibold text-slate-800">
            Register
          </span>
        </nav>
      </div>

      {/* 2. Main Two-Column Layout */}
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Left Column (Width ~ 7 cols): Event Registration Form */}
          <div className="lg:col-span-7 xl:col-span-7">
            <EventRegistrationFlow
              eventId={event.id || ''}
              slug={event.slug}
              eventTitle={event.title}
              startsAt={event.startsAt}
              endsAt={event.endsAt}
              venueName={event.venueName}
              city={event.city}
              isOnline={event.isOnline}
              meetingUrl={myReg?.meetingUrl}
              isRegistered={isRegistered}
              isSignedIn={Boolean(donor)}
              availability={action.kind}
              registrationDeadline={event.registrationDeadline ?? null}
              signInHref={`/sign-in?next=/events/${event.slug}/register`}
              initialProfile={initialProfile}
            />
          </div>

          {/* Right Column (Width ~ 5 cols): Event Summary Card */}
          <div className="lg:sticky lg:top-24 lg:col-span-5 xl:col-span-5">
            <EventSummaryCard
              event={event}
              categoryName={categoryName}
              supportEmail={supportEmail}
              supportPhone={supportPhone}
              supportPhoneHref={supportPhoneHref}
              seatsLeft={seatsLeft}
              availability={action.kind}
              shareUrl={canonicalUrl(`/events/${event.slug}`)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
