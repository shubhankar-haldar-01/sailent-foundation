import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { EventRegistrationFlow } from '@/components/events/event-registration-flow';
import { EventRegistrationHero } from '@/components/events/event-registration-hero';
import { EventSummaryCard } from '@/components/events/event-summary-card';
import { cardAction } from '@/components/events/events-query';
import { currentDonor } from '@/lib/auth/donor-session';
import { getEvent, getProgram } from '@/lib/content';
import { getOrganisation } from '@/lib/content/organisation';
import { donorFetch, type DonorProfile } from '@/lib/donor/api';
import { buildMetadata, canonicalUrl } from '@/lib/seo/metadata';
import { jsonLd } from '@/lib/seo/structured-data';

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
    title: event.title,
    description: event.summary,
    path: `/events/${event.slug}`,
  });
}

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  const [program, organisation, donor] = await Promise.all([
    event.programSlug ? getProgram(event.programSlug).catch(() => null) : Promise.resolve(null),
    getOrganisation(),
    currentDonor(),
  ]);

  // An event without a programme has no category, as on its card: nothing is invented.
  const categoryName = program?.category || program?.name || null;
  // The shared rule, as the card on /events and the API apply it.
  const action = cardAction(event);

  // Load donor profile & registration if signed in
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

  /**
   * Event structured data. `eventAttendanceMode` and `location` reflect what is
   * actually true; no `offers` block is emitted because attendance is free.
   */
  const eventSchema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.summary,
    startDate: event.startsAt,
    ...(event.endsAt ? { endDate: event.endsAt } : {}),
    eventStatus: `https://schema.org/Event${event.status === 'cancelled' ? 'Cancelled' : 'Scheduled'}`,
    eventAttendanceMode: event.isOnline
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    location: event.isOnline
      ? { '@type': 'VirtualLocation', url: 'https://sailentfoundation.org/events' }
      : {
          '@type': 'Place',
          name: event.venueName ?? 'Venue to be confirmed',
          address: event.address ?? event.city ?? 'India',
        },
    organizer: { '@type': 'NGO', name: 'Sailent Foundation' },
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#F8FAFC]">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(eventSchema)} />

      {/* 1. Event Hero Section matching exact design */}
      <EventRegistrationHero event={event} categoryName={categoryName} />

      {/* 2. Main Two-Column Layout */}
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
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
              signInHref={`/sign-in?next=/events/${event.slug}`}
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
