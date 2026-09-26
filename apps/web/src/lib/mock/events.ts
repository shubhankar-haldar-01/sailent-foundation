import type { SailentEvent } from './types';

/**
 * Event fixtures.
 *
 * ⚠️ DEVELOPMENT CONTENT. Dates are relative to the demo build date so the
 * listing always has a sensible mix of upcoming and past events rather than
 * going stale.
 */

/** Dates are generated relative to now so the listing never looks abandoned. */
function daysFromNow(days: number, hour = 10): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

export const events: SailentEvent[] = [
  {
    slug: 'volunteer-orientation-october',
    title: 'Volunteer orientation',
    summary:
      'A half-day session for newly approved volunteers covering our programs, field conduct and what a first assignment involves.',
    startsAt: daysFromNow(12, 10),
    endsAt: daysFromNow(12, 14),
    venueName: 'Sailent Foundation field office',
    city: 'Ranchi',
    address: 'Field office, Namkum block, Ranchi district, Jharkhand',
    isOnline: false,
    capacity: 40,
    registeredCount: 27,
    status: 'registration_open',
    programSlug: null,
    campaignSlug: null,
    requiresVolunteers: false,
    description: [
      'Every volunteer who joins us attends an orientation before their first assignment. It is not a formality — most of what makes fieldwork go badly is avoidable with half a day of context.',
      'The session covers how our programs actually run, what is expected of you in a village setting, child protection and safeguarding, and the practical business of attendance, hours and certification.',
      'Bring a photo ID. Lunch is provided.',
    ],
    schedule: [
      { time: '10:00', activity: 'Welcome and introduction to the programs' },
      { time: '11:00', activity: 'Field conduct and safeguarding' },
      { time: '12:30', activity: 'Lunch' },
      { time: '13:15', activity: 'Assignments, attendance and certification' },
      { time: '14:00', activity: 'Questions and close' },
    ],
    cover: { seed: 'event-orientation', alt: 'Volunteers seated at an orientation session' },
    gallery: [],
  },
  {
    slug: 'school-kit-distribution-namkum',
    title: 'School kit distribution',
    summary:
      'Distribution across four partner schools. Volunteers help with sorting, sizing and record-keeping.',
    startsAt: daysFromNow(21, 9),
    endsAt: daysFromNow(21, 16),
    venueName: 'Government Middle School, Namkum',
    city: 'Ranchi',
    address: 'Government Middle School, Namkum block, Ranchi district, Jharkhand',
    isOnline: false,
    capacity: 25,
    registeredCount: 25,
    status: 'registration_open',
    programSlug: 'education',
    campaignSlug: 'school-kits-jharkhand',
    requiresVolunteers: true,
    description: [
      'Distribution days are the visible end of the school kit campaign, and they need more hands than our field team has.',
      'Volunteers help with sorting kits by class level, checking uniform sizes, and keeping the distribution record that lets us track attendance afterwards. No prior experience is needed; the work is straightforward and the field team briefs everyone on arrival.',
      'This event is currently at capacity. Register to join the waitlist — places do open up.',
    ],
    schedule: [
      { time: '09:00', activity: 'Arrival, briefing and sorting' },
      { time: '10:30', activity: 'Distribution begins — school one and two' },
      { time: '13:00', activity: 'Lunch' },
      { time: '14:00', activity: 'Distribution — school three and four' },
      { time: '16:00', activity: 'Record reconciliation and close' },
    ],
    cover: { seed: 'event-distribution', alt: 'Volunteers sorting school kits for distribution' },
    gallery: [],
  },
  {
    slug: 'medical-camp-kondagaon',
    title: 'Extended medical camp — Kondagaon',
    summary: 'A two-day camp with visiting specialists, alongside the regular mobile clinic route.',
    startsAt: daysFromNow(34, 8),
    endsAt: daysFromNow(35, 17),
    venueName: 'Community hall, Kondagaon',
    city: 'Bastar',
    address: 'Community hall, Kondagaon, Bastar district, Chhattisgarh',
    isOnline: false,
    capacity: 15,
    registeredCount: 6,
    status: 'registration_open',
    programSlug: 'healthcare',
    campaignSlug: 'mobile-health-clinic-bastar',
    requiresVolunteers: true,
    description: [
      'Twice a year we run an extended camp with visiting specialists — ophthalmology, orthopaedics and paediatrics — for cases the monthly clinic can identify but not treat.',
      'We need volunteers for registration, queue management and translation. Medical qualifications are welcome but not required; most of the work is organizational.',
    ],
    schedule: [
      { time: 'Day 1, 08:00', activity: 'Setup and registration opens' },
      { time: 'Day 1, 09:00', activity: 'General and paediatric consultations' },
      { time: 'Day 2, 09:00', activity: 'Specialist consultations' },
      { time: 'Day 2, 16:00', activity: 'Referral coordination and close' },
    ],
    cover: {
      seed: 'event-medical-camp',
      alt: 'A medical camp with patients registering at a desk',
    },
    gallery: [],
  },
  {
    slug: 'annual-review-meeting',
    title: 'Annual review — open session',
    summary:
      'Our yearly public review of what worked, what did not, and what the numbers actually show. Online and open to anyone.',
    startsAt: daysFromNow(48, 17),
    endsAt: daysFromNow(48, 19),
    venueName: null,
    city: null,
    address: null,
    isOnline: true,
    capacity: null,
    registeredCount: 184,
    status: 'registration_open',
    programSlug: null,
    campaignSlug: null,
    requiresVolunteers: false,
    description: [
      'Once a year we present the full picture publicly: program by program, what we set out to do, what happened, and where we fell short.',
      'The session is deliberately open to anyone — donors, volunteers, partner organizations, and people who simply want to check whether we are worth supporting. Questions are taken live and unfiltered.',
      'A recording and the full slide deck are published on the transparency page afterwards.',
    ],
    schedule: [
      { time: '17:00', activity: 'Program review — education and healthcare' },
      { time: '17:45', activity: 'Program review — child welfare, livelihoods, environment' },
      { time: '18:20', activity: 'Financials and fund utilisation' },
      { time: '18:40', activity: 'Open questions' },
    ],
    cover: {
      seed: 'event-review',
      alt: 'A presentation slide being discussed at a review meeting',
    },
    gallery: [],
  },
  {
    slug: 'tree-plantation-drive-kalahandi',
    title: 'Community plantation drive',
    summary:
      'Planting alongside village committees, with a maintenance commitment for twelve months.',
    startsAt: daysFromNow(-26, 7),
    endsAt: daysFromNow(-26, 13),
    venueName: 'Village common land',
    city: 'Kalahandi',
    address: 'Village common land, Kalahandi district, Odisha',
    isOnline: false,
    capacity: 60,
    registeredCount: 52,
    status: 'completed',
    programSlug: 'environment',
    campaignSlug: null,
    requiresVolunteers: true,
    description: [
      'Fifty-two volunteers joined village committees to plant across common land ahead of the monsoon.',
      'Species were chosen by the committees for fodder, fruit and income value rather than for planting-day photographs — saplings that people have a reason to protect are the ones that survive their first year.',
      'Survival will be counted at twelve months and published, including if the number disappoints.',
    ],
    schedule: [
      { time: '07:00', activity: 'Arrival and site briefing' },
      { time: '07:30', activity: 'Planting' },
      { time: '12:00', activity: 'Maintenance handover to village committee' },
    ],
    cover: { seed: 'event-plantation', alt: 'Volunteers planting saplings on common land' },
    gallery: [
      { seed: 'event-plantation-2', alt: 'A volunteer watering a newly planted sapling' },
      { seed: 'event-plantation-3', alt: 'Village committee members and volunteers together' },
    ],
  },
  {
    slug: 'donor-field-visit-june',
    title: 'Donor field visit — Ranchi district',
    summary: 'A day with the education program, for supporters who want to see the work directly.',
    startsAt: daysFromNow(-68, 8),
    endsAt: daysFromNow(-68, 17),
    venueName: 'Partner schools, Namkum block',
    city: 'Ranchi',
    address: 'Namkum block, Ranchi district, Jharkhand',
    isOnline: false,
    capacity: 12,
    registeredCount: 12,
    status: 'completed',
    programSlug: 'education',
    campaignSlug: 'school-kits-jharkhand',
    requiresVolunteers: false,
    description: [
      'We run small field visits a few times a year for supporters who would rather see the work than read about it.',
      'Groups are kept to twelve so that visits do not disrupt teaching. The day includes two partner schools, a learning centre session, and an unstructured conversation with the field team about what is not going well.',
    ],
    schedule: [
      { time: '08:00', activity: 'Departure from Ranchi' },
      { time: '09:30', activity: 'Partner school visit' },
      { time: '12:00', activity: 'Learning centre session' },
      { time: '14:00', activity: 'Field team discussion' },
    ],
    cover: { seed: 'event-field-visit', alt: 'Visitors observing a classroom session' },
    gallery: [],
  },
];

export function getEvent(slug: string): SailentEvent | undefined {
  return events.find((event) => event.slug === slug);
}

export function getUpcomingEvents(): SailentEvent[] {
  const now = Date.now();
  return events
    .filter((event) => new Date(event.startsAt).getTime() >= now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export function getPastEvents(): SailentEvent[] {
  const now = Date.now();
  return events
    .filter((event) => new Date(event.startsAt).getTime() < now)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
}

export function getEventsByProgram(programSlug: string): SailentEvent[] {
  return events.filter((event) => event.programSlug === programSlug);
}
