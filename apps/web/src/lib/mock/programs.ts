import type { Program } from './types';

/**
 * Program fixtures.
 *
 * ⚠️ DEVELOPMENT CONTENT. Every figure below is illustrative and is rendered
 * with a visible demo marker (decision A14). Nothing here is a claim about what
 * Sailent Foundation has done — the organization supplies real copy and real
 * numbers before launch.
 */

/**
 * A programme fixture: everything but its open-campaign count, which the
 * content layer derives from the campaign fixtures (`countOpenCampaigns`)
 * rather than trusting a typed-in number that drifted from them.
 */
export type ProgramFixture = Omit<Program, 'activeCampaignCount'>;

export const programs: ProgramFixture[] = [
  {
    slug: 'education',
    name: 'Education',
    tagline: 'Keeping children in school, and helping them stay there',
    shortDescription:
      'Learning support, materials and school infrastructure for children in under-served districts.',
    problem:
      'Children in the districts we work in rarely leave school because they stop caring. They leave because a textbook costs more than a day of family income, because the nearest secondary school is eleven kilometres away, or because an older sibling needs to start earning. The barrier is almost never ability.',
    approach:
      'We work with existing government schools rather than building parallel ones. That means supplying the materials a child needs to keep attending, running after-school support for students who have fallen behind, and repairing the infrastructure — a roof, a toilet block, a library — that quietly decides whether families keep sending their daughters.',
    goals: [
      {
        title: 'Remove the cost barrier',
        description:
          'Supply the kits, books and uniforms that make attendance possible, at the start of the academic year rather than halfway through it.',
      },
      {
        title: 'Catch students before they fall behind',
        description:
          'Run after-school sessions for children who have missed significant schooling, so returning students are not set up to fail.',
      },
      {
        title: 'Make schools somewhere families trust',
        description:
          'Repair the facilities — particularly sanitation — that determine whether adolescent girls continue past primary school.',
      },
    ],
    beneficiaries:
      'Children aged 6–16 in government schools across rural districts, with particular attention to first-generation learners and girls at risk of dropping out.',
    locations: [
      { district: 'Ranchi', state: 'Jharkhand' },
      { district: 'Gaya', state: 'Bihar' },
      { district: 'Kalahandi', state: 'Odisha' },
    ],
    activities: [
      {
        title: 'School kit distribution',
        description:
          'Notebooks, stationery, a bag and uniform, distributed before the academic year begins.',
      },
      {
        title: 'After-school learning centres',
        description:
          'Small-group sessions in reading and arithmetic, run in village spaces by trained local facilitators.',
      },
      {
        title: 'Library and infrastructure support',
        description:
          'Reading corners, repairs to classrooms and sanitation blocks, in partnership with school management committees.',
      },
      {
        title: 'Family engagement',
        description:
          'Regular conversations with parents of students at risk of dropping out, because attendance decisions are made at home.',
      },
    ],
    metrics: [
      { label: 'Children supported', value: 2840 },
      { label: 'Schools partnered', value: 34 },
      { label: 'Learning centres', value: 12 },
    ],
    accentIcon: 'book',
    cover: {
      seed: 'program-education',
      alt: 'Children in a government primary school classroom during a lesson',
    },
  },
  {
    slug: 'healthcare',
    name: 'Healthcare',
    tagline: 'Basic care, close to home',
    shortDescription:
      'Mobile clinics, medicines and maternal health support in villages far from the nearest hospital.',
    problem:
      'A fever that would be routine in a city becomes dangerous when the nearest functioning clinic is a four-hour journey and a day of lost wages. For pregnant women, that distance is the difference between a monitored pregnancy and an unmonitored one.',
    approach:
      'Rather than building hospitals, we bring basic care to where people already are: scheduled mobile clinics, community health workers drawn from the villages themselves, and referral support for cases that genuinely need a hospital. The aim is to make the routine routine again.',
    goals: [
      {
        title: 'Make primary care reachable',
        description:
          'Run scheduled clinics so that seeing a doctor does not cost a day of work and a day of wages.',
      },
      {
        title: 'Support pregnancies properly',
        description:
          'Antenatal checks, iron supplementation and institutional-delivery support for expectant mothers.',
      },
      {
        title: 'Build local capability',
        description:
          'Train community health workers from within each village, so care does not leave when we do.',
      },
    ],
    beneficiaries:
      'Families in villages more than 15km from a functioning primary health centre, with priority for expectant mothers, infants and the elderly.',
    locations: [
      { district: 'Bastar', state: 'Chhattisgarh' },
      { district: 'Kalahandi', state: 'Odisha' },
    ],
    activities: [
      {
        title: 'Mobile health clinics',
        description: 'Scheduled visits with a doctor, nurse and essential medicines.',
      },
      {
        title: 'Maternal health program',
        description: 'Antenatal care, nutrition support and delivery planning.',
      },
      {
        title: 'Community health worker training',
        description: 'Recruiting and training women from each village to provide first-line care.',
      },
      {
        title: 'Referral and transport support',
        description:
          'Helping families reach a hospital when a case needs more than a clinic can give.',
      },
    ],
    metrics: [
      { label: 'Consultations provided', value: 9120 },
      { label: 'Villages on the clinic route', value: 26 },
      { label: 'Health workers trained', value: 48 },
    ],
    accentIcon: 'heart',
    cover: {
      seed: 'program-healthcare',
      alt: 'A mobile health clinic set up under a shelter in a village',
    },
  },
  {
    slug: 'child-welfare',
    name: 'Child Welfare',
    tagline: 'Safety, nutrition and a place to be a child',
    shortDescription:
      'Nutrition, protection and safe spaces for children in vulnerable households.',
    problem:
      'Malnutrition in the first five years does damage that later schooling cannot undo. Children in households under acute economic stress are also the most likely to be pulled into work, early marriage, or migration with a parent.',
    approach:
      'We combine nutritional support with day-to-day presence: community crèches that let mothers work, supplementary nutrition tracked child by child, and a protection network that notices when a child stops turning up.',
    goals: [
      {
        title: 'Address early malnutrition',
        description:
          'Track growth and provide supplementary nutrition for children under five, measured individually rather than in aggregate.',
      },
      {
        title: 'Create safe daytime spaces',
        description: 'Community crèches so young children are supervised while parents work.',
      },
      {
        title: 'Notice when something changes',
        description:
          'A local network that follows up when a child stops attending, before a temporary absence becomes permanent.',
      },
    ],
    beneficiaries:
      'Children under twelve in households facing acute economic stress, seasonal migration or single-parent care.',
    locations: [
      { district: 'Ranchi', state: 'Jharkhand' },
      { district: 'Gaya', state: 'Bihar' },
    ],
    activities: [
      {
        title: 'Community crèches',
        description: 'Supervised daytime care for children under six.',
      },
      {
        title: 'Nutrition monitoring',
        description: 'Individual growth tracking with supplementary nutrition where indicated.',
      },
      {
        title: 'Child protection network',
        description: 'Trained local volunteers who follow up on absences and at-risk households.',
      },
    ],
    metrics: [
      { label: 'Children in nutrition support', value: 1260 },
      { label: 'Community crèches running', value: 9 },
    ],
    accentIcon: 'shield',
    cover: {
      seed: 'program-child-welfare',
      alt: 'Young children at a community crèche with a care worker',
    },
  },
  {
    slug: 'women-empowerment',
    name: 'Women Empowerment',
    tagline: 'Income, independence and a say in the decision',
    shortDescription:
      'Skills training, self-help groups and enterprise support for women in rural households.',
    problem:
      'In many of the households we work with, women do most of the work and control none of the income. Without earnings of her own, a woman has limited say in whether her daughter stays in school or when she marries.',
    approach:
      'Self-help groups first, because collective savings change the terms on which women borrow. Then skills that map to something actually sellable locally, and support through the unglamorous parts of starting an enterprise — registration, pricing, finding a buyer.',
    goals: [
      {
        title: 'Build financial independence',
        description: 'Self-help groups with collective savings and access to fair credit.',
      },
      {
        title: 'Teach skills with a market',
        description:
          'Training chosen against local demand rather than what is convenient to teach.',
      },
      {
        title: 'Support the first year',
        description: 'Mentoring through the period where most new enterprises fail.',
      },
    ],
    beneficiaries:
      'Women aged 18–45 in rural households, with priority for single-income families and women returning to work.',
    locations: [
      { district: 'Ranchi', state: 'Jharkhand' },
      { district: 'Bastar', state: 'Chhattisgarh' },
    ],
    activities: [
      { title: 'Self-help group formation', description: 'Collective savings and credit groups.' },
      {
        title: 'Vocational training',
        description: 'Tailoring, food processing and handicraft skills matched to local demand.',
      },
      {
        title: 'Enterprise mentoring',
        description: 'Practical support through registration, pricing and market access.',
      },
    ],
    metrics: [
      { label: 'Women in active groups', value: 1480 },
      { label: 'Enterprises started', value: 210 },
    ],
    accentIcon: 'sprout',
    cover: {
      seed: 'program-women',
      alt: 'Women meeting as a self-help group, seated in a circle',
    },
  },
  {
    slug: 'livelihood',
    name: 'Livelihood',
    tagline: 'Work that lasts longer than a season',
    shortDescription:
      'Vocational training and job placement for young adults with no formal qualifications.',
    problem:
      'Young adults in these districts are not short of willingness to work. They are short of any credential that lets an employer take a chance on them, and of the bus fare to attend an interview in a city they have never visited.',
    approach:
      'Short, practical courses with a recognised certificate at the end, run close to where trainees live, followed by actual placement support rather than a certificate and good wishes.',
    goals: [
      {
        title: 'Provide a credential that counts',
        description: 'Certified training in trades with genuine local and regional demand.',
      },
      {
        title: 'Bridge the gap to employment',
        description: 'Placement support, interview preparation and first-month transition help.',
      },
    ],
    beneficiaries: 'Young adults aged 18–30 without formal qualifications or stable employment.',
    locations: [{ district: 'Ranchi', state: 'Jharkhand' }],
    activities: [
      {
        title: 'Certified vocational courses',
        description: 'Three to six month programs in electrical work, tailoring and hospitality.',
      },
      {
        title: 'Placement support',
        description: 'Employer partnerships and interview preparation.',
      },
    ],
    metrics: [
      { label: 'Trainees enrolled', value: 640 },
      { label: 'Placed in work', value: 410 },
    ],
    accentIcon: 'briefcase',
    cover: {
      seed: 'program-livelihood',
      alt: 'A young trainee working at a sewing machine in a vocational training centre',
    },
  },
  {
    slug: 'environment',
    name: 'Environment',
    tagline: 'Water, soil and shade where communities need them',
    shortDescription:
      'Water conservation, tree planting and sustainable farming practice with village committees.',
    problem:
      'Falling water tables and degraded soil are not abstract environmental problems here — they are the reason a family harvests less this year than last, and why a young person leaves for the city.',
    approach:
      'Work led by village water committees rather than imposed on them: check dams and recharge structures where the committee says water is lost, planting that people have a reason to protect, and farming practice that shows a return within one season.',
    goals: [
      {
        title: 'Restore groundwater',
        description: 'Recharge structures and check dams sited by the communities that use them.',
      },
      {
        title: 'Make planting worth protecting',
        description:
          'Species with fodder, fruit or income value, so saplings survive their first year.',
      },
    ],
    beneficiaries: 'Farming households in water-stressed blocks.',
    locations: [{ district: 'Kalahandi', state: 'Odisha' }],
    activities: [
      { title: 'Water conservation structures', description: 'Check dams and recharge pits.' },
      { title: 'Community plantation', description: 'Planting with village-led maintenance.' },
      {
        title: 'Sustainable farming training',
        description: 'Practices that show a measurable return within a season.',
      },
    ],
    metrics: [
      { label: 'Water structures built', value: 38 },
      { label: 'Saplings planted', value: 12400 },
    ],
    accentIcon: 'leaf',
    cover: {
      seed: 'program-environment',
      alt: 'A newly built check dam holding water in a rural landscape',
    },
  },
  {
    slug: 'animal-welfare',
    name: 'Animal Welfare',
    tagline: 'Care for the animals communities depend on',
    shortDescription:
      'Veterinary camps and livestock health support for households whose income depends on animals.',
    problem:
      'For a household with two goats and a cow, an untreated animal illness is not a welfare issue — it is the loss of most of the year’s income.',
    approach:
      'Scheduled veterinary camps, vaccination drives, and training for households on the basics of livestock health, alongside care for street animals in the towns we work near.',
    goals: [
      {
        title: 'Protect livestock income',
        description: 'Vaccination and treatment camps timed to the agricultural calendar.',
      },
    ],
    beneficiaries: 'Households whose primary or supplementary income depends on livestock.',
    locations: [{ district: 'Bastar', state: 'Chhattisgarh' }],
    activities: [
      { title: 'Veterinary camps', description: 'Treatment and vaccination at village level.' },
      { title: 'Livestock health training', description: 'Basic animal husbandry for households.' },
    ],
    metrics: [{ label: 'Animals treated', value: 3100 }],
    accentIcon: 'paw',
    cover: {
      seed: 'program-animal',
      alt: 'A veterinarian examining livestock at a village camp',
    },
  },
];

export function getProgram(slug: string): ProgramFixture | undefined {
  return programs.find((program) => program.slug === slug);
}
