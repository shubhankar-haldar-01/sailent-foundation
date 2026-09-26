/**
 * Impact fixtures.
 *
 * ⚠️ DEVELOPMENT CONTENT — and the most sensitive kind. Decision A14 forbids
 * presenting an unverifiable number as fact, so every figure here is rendered
 * through a component that marks it as demo data, and the site carries a
 * standing notice that this is a development build.
 *
 * In Phase 6 these are replaced by live database aggregates and dated
 * `impact_records`, and the demo marker disappears with them.
 */

export interface ImpactMetric {
  id: string;
  label: string;
  value: number;
  unit?: string;
  /** How this number would be derived once real data exists. */
  derivation: string;
}

export const headlineMetrics: ImpactMetric[] = [
  {
    id: 'beneficiaries',
    label: 'People reached',
    value: 18_400,
    derivation: 'Sum of beneficiaries recorded across all completed program activities.',
  },
  {
    id: 'projects',
    label: 'Projects completed',
    value: 86,
    derivation: 'Count of campaigns and program projects marked complete.',
  },
  {
    id: 'volunteers',
    label: 'Active volunteers',
    value: 214,
    derivation: 'Count of volunteers with status Active.',
  },
  {
    id: 'volunteer-hours',
    label: 'Volunteer hours',
    value: 9_760,
    unit: 'hrs',
    derivation: 'Sum of verified attendance hours. Unverified hours are excluded.',
  },
];

export const reachMetrics: ImpactMetric[] = [
  {
    id: 'districts',
    label: 'Districts',
    value: 6,
    derivation: 'Distinct districts across all active program locations.',
  },
  {
    id: 'states',
    label: 'States',
    value: 4,
    derivation: 'Distinct states across all active program locations.',
  },
  {
    id: 'villages',
    label: 'Villages',
    value: 112,
    derivation: 'Distinct villages recorded in program activity logs.',
  },
  {
    id: 'partners',
    label: 'Partner institutions',
    value: 41,
    derivation: 'Schools, health centres and village committees under formal partnership.',
  },
];

export interface GeographicReach {
  state: string;
  districts: string[];
  programmes: string[];
  beneficiaries: number;
}

export const geographicReach: GeographicReach[] = [
  {
    state: 'Jharkhand',
    districts: ['Ranchi'],
    programmes: ['Education', 'Child Welfare', 'Women Empowerment', 'Livelihood'],
    beneficiaries: 7_320,
  },
  {
    state: 'Bihar',
    districts: ['Gaya'],
    programmes: ['Education', 'Child Welfare'],
    beneficiaries: 4_180,
  },
  {
    state: 'Chhattisgarh',
    districts: ['Bastar'],
    programmes: ['Healthcare', 'Women Empowerment', 'Animal Welfare'],
    beneficiaries: 5_240,
  },
  {
    state: 'Odisha',
    districts: ['Kalahandi'],
    programmes: ['Healthcare', 'Environment'],
    beneficiaries: 1_660,
  },
];

export interface ImpactUpdate {
  id: string;
  title: string;
  body: string;
  occurredOn: string;
  location: string;
  programSlug: string;
  metric?: { label: string; value: number; unit?: string };
}

export const impactUpdates: ImpactUpdate[] = [
  {
    id: 'iu-1',
    title: 'Reading corners installed across fourteen schools',
    body: 'Each classroom received roughly sixty age-graded titles and a teacher orientation on using them during school hours. Final-period attendance rose over the term; reading assessment scores did not move measurably, which is what we expected over a single term.',
    occurredOn: '2026-08-28',
    location: 'Ranchi, Jharkhand',
    programSlug: 'education',
    metric: { label: 'Reading corners', value: 14 },
  },
  {
    id: 'iu-2',
    title: 'Clinic route extended to four additional villages',
    body: 'Following a request from the block health officer, the monthly mobile clinic route now covers thirty villages rather than twenty-six, adding roughly nine hundred people to the catchment.',
    occurredOn: '2026-08-05',
    location: 'Bastar, Chhattisgarh',
    programSlug: 'healthcare',
    metric: { label: 'Villages on route', value: 30 },
  },
  {
    id: 'iu-3',
    title: 'Second tailoring cohort completes; 41 of 60 earning',
    body: 'Across both cohorts, forty-one of sixty participants were earning income six weeks after completing the course. We will follow up at six months and publish that figure whatever it shows.',
    occurredOn: '2026-09-02',
    location: 'Ranchi, Jharkhand',
    programSlug: 'women-empowerment',
    metric: { label: 'Women earning', value: 41 },
  },
  {
    id: 'iu-4',
    title: 'First two check dams complete before the monsoon',
    body: 'Both structures held through the monsoon. Water levels in adjacent wells are being measured monthly through the dry season and will be published against comparable wells outside the catchment.',
    occurredOn: '2026-08-30',
    location: 'Kalahandi, Odisha',
    programSlug: 'environment',
    metric: { label: 'Structures completed', value: 2 },
  },
  {
    id: 'iu-5',
    title: 'Growth screening completed in nine villages',
    body: 'One hundred and five children under five were identified as underweight and enrolled in the nutrition program. Re-measurement is at six-week intervals.',
    occurredOn: '2026-07-20',
    location: 'Gaya, Bihar',
    programSlug: 'child-welfare',
    metric: { label: 'Children enrolled', value: 105 },
  },
];

/** How impact is measured — the most persuasive content on the impact page. */
export const methodologyNotes = [
  {
    title: 'We count people, not distributions',
    body: 'A kit handed out is an activity, not an outcome. Where we report people reached, we mean individuals recorded by name in a program register, counted once.',
  },
  {
    title: 'Volunteer hours are verified hours',
    body: 'Only attendance confirmed by a program manager is counted. Self-reported hours are recorded separately and excluded from every public figure.',
  },
  {
    title: 'We publish results that disappointed us',
    body: 'Programs that did not work are reported in the annual review alongside those that did. A report in which everything succeeded is describing a selection process.',
  },
  {
    title: 'Single-season results are labelled as such',
    body: 'Some outcomes — water table recovery, reading ability, income stability — cannot be established in one season. Where a figure is preliminary, we say so rather than rounding it into a headline.',
  },
];
