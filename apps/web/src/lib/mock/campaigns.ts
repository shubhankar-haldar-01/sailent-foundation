import type { Campaign } from './types';

/**
 * Campaign fixtures.
 *
 * ⚠️ DEVELOPMENT CONTENT. Amounts, donor counts and progress figures are
 * illustrative. They are rendered inside a build that carries a site-wide demo
 * notice, and no figure here is presented as a verified claim (decision A14).
 *
 * All amounts are integer PAISE (decision A2). ₹900 is 90_000.
 */

const rupees = (value: number): number => value * 100;

export const campaigns: Campaign[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'school-kits-jharkhand',
    title: 'School kits for 500 children in Ranchi district',
    shortDescription:
      'A kit costs ₹900 and covers a child for the full academic year — notebooks, stationery, a bag and a uniform.',
    programName: 'Education',
    programSlug: 'education',
    category: 'Education',
    location: 'Ranchi, Jharkhand',
    goalAmount: rupees(450_000),
    amountRaised: rupees(318_600),
    donorCount: 247,
    startsAt: '2026-06-01T00:00:00+05:30',
    endsAt: '2026-11-30T00:00:00+05:30',
    status: 'active',
    hasProducts: true,
    isFeatured: true,
    beneficiaryTarget: 500,
    beneficiariesReached: 354,
    beneficiaryContext:
      'Children entering classes 1 to 8 at fourteen government schools across three blocks of Ranchi district. Most are first-generation learners; for many families the cost of materials is the single reason a child stops attending.',
    story: [
      'The academic year begins in June. By the middle of July, teachers at the schools we work with can already tell you which children will stop coming — not because of ability, and not because their families do not care, but because a notebook, a bag and a uniform together cost more than a household earns in three days.',
      'A school kit removes that specific barrier. It is not a solution to rural education, and we do not present it as one. It is the thing standing between a willing child and a classroom in the months when the decision gets made.',
      'We distribute before the year starts rather than partway through, because a child who has already missed six weeks is much harder to bring back than one who never left.',
    ],
    products: [
      {
        id: 'school-kit',
        name: 'School Kit',
        description:
          'Notebooks, stationery, a school bag and two uniforms — everything one child needs for a full academic year.',
        unitAmount: rupees(900),
        targetQuantity: 500,
        providedQuantity: 354,
        status: 'active',
        maxPerDonation: 100,
        image: {
          seed: 'product-school-kit',
          alt: 'A school kit laid out: notebooks, pens, bag and uniform',
        },
      },
      {
        id: 'textbook-set',
        name: 'Textbook Set',
        description:
          'The full prescribed textbook set for one child, for one academic year and one class level.',
        unitAmount: rupees(600),
        targetQuantity: 500,
        providedQuantity: 291,
        status: 'active',
        maxPerDonation: 100,
        image: { seed: 'product-textbooks', alt: 'A stack of school textbooks' },
      },
      {
        id: 'library-corner',
        name: 'Reading Corner',
        description:
          'A set of age-appropriate storybooks and a shelf for one classroom, shared by roughly forty children.',
        unitAmount: rupees(4_500),
        targetQuantity: 14,
        providedQuantity: 14,
        status: 'fulfilled',
        maxPerDonation: 20,
        image: {
          seed: 'product-reading-corner',
          alt: 'A classroom reading corner with a small bookshelf',
        },
      },
    ],
    updates: [
      {
        id: 'u1',
        title: 'First 200 kits distributed across four schools',
        body: 'Distribution began at the start of the academic year at four schools in Namkum block. Head teachers recorded attendance in the two weeks following distribution; we will publish the comparison once the term is complete.',
        publishedAt: '2026-07-14T00:00:00+05:30',
        media: { seed: 'update-kits-1', alt: 'Children receiving school kits in a classroom' },
      },
      {
        id: 'u2',
        title: 'Reading corners completed at all fourteen schools',
        body: 'The reading corner component is fully funded and installed. Each set includes roughly sixty age-graded titles in Hindi and English, with a teacher orientation session on using them during class hours.',
        publishedAt: '2026-08-28T00:00:00+05:30',
      },
    ],
    // No attached documents: the fallback fixtures describe campaigns, and a
    // document is a real file in a real bucket (Phase 10.10).
    documents: [],
    faqs: [
      {
        question: 'What exactly is in a school kit?',
        answer:
          'Six notebooks, a geometry set, pens and pencils, a school bag, and two sets of uniform in the child’s size. The contents are the same for every child in a class level.',
      },
      {
        question: 'How are the children selected?',
        answer:
          'Head teachers at partner schools identify students whose attendance is at risk for economic reasons. We do not select individually; we supply the full class level at a partner school so that no child is singled out.',
      },
      {
        question: 'What happens if the campaign raises more than its goal?',
        answer:
          'Additional funds extend the same program to the next set of schools on our waiting list, in the same district. We say so before you give rather than afterwards.',
      },
    ],
    impactNotes: [
      { label: 'Kits provided', value: 354 },
      { label: 'Schools reached', value: 14 },
      { label: 'Reading corners installed', value: 14 },
    ],
    cover: {
      seed: 'campaign-school-kits',
      alt: 'Children with new school bags outside a government primary school',
    },
    gallery: [
      { seed: 'campaign-school-kits-2', alt: 'A teacher distributing notebooks to a class' },
      { seed: 'campaign-school-kits-3', alt: 'A child writing in a new notebook' },
      { seed: 'campaign-school-kits-4', alt: 'School bags stacked ready for distribution' },
    ],
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    slug: 'mobile-health-clinic-bastar',
    title: 'Keep the mobile health clinic running in Bastar',
    shortDescription:
      'One clinic day reaches around sixty patients in villages more than four hours from a hospital.',
    programName: 'Healthcare',
    programSlug: 'healthcare',
    category: 'Healthcare',
    location: 'Bastar, Chhattisgarh',
    goalAmount: rupees(720_000),
    amountRaised: rupees(494_000),
    donorCount: 312,
    startsAt: '2026-04-01T00:00:00+05:30',
    endsAt: '2027-03-31T00:00:00+05:30',
    status: 'active',
    hasProducts: true,
    isFeatured: true,
    beneficiaryTarget: 6000,
    beneficiariesReached: 4120,
    beneficiaryContext:
      'Families in twenty-six villages across Bastar district, each more than fifteen kilometres from a functioning primary health centre. The clinic visits each village on a fixed monthly schedule.',
    story: [
      'The clinic is a vehicle, a doctor, a nurse, and a box of medicines that arrives in the same village on the same day each month. That predictability is most of the value: people plan around it, bring their children for it, and stop treating a doctor’s visit as an emergency measure.',
      'Most of what the clinic treats is unremarkable — respiratory infections, skin conditions, untreated hypertension, anaemia in pregnancy. It is unremarkable precisely because it has gone untreated, and because the alternative costs a day of travel and a day of lost wages.',
      'This campaign funds the running cost for a full year: fuel, medicines, staff and the referral support for the small number of cases each month that need a hospital.',
    ],
    products: [
      {
        id: 'medicine-kit',
        name: 'Medicine Kit',
        description:
          'Essential medicines for one clinic day — enough to treat roughly sixty patients across one village visit.',
        unitAmount: rupees(1_200),
        targetQuantity: 300,
        providedQuantity: 198,
        status: 'active',
        maxPerDonation: 100,
        image: {
          seed: 'product-medicine-kit',
          alt: 'A medical supply kit with essential medicines',
        },
      },
      {
        id: 'maternal-checkup',
        name: 'Maternal Care Package',
        description:
          'A full antenatal package for one expectant mother: four checkups, iron supplementation and delivery planning.',
        unitAmount: rupees(2_400),
        targetQuantity: 150,
        providedQuantity: 96,
        status: 'active',
        maxPerDonation: 50,
        image: { seed: 'product-maternal', alt: 'A nurse conducting an antenatal check' },
      },
      {
        id: 'clinic-day',
        name: 'Sponsor a Clinic Day',
        description:
          'The complete cost of one village clinic day — staff, fuel, medicines and referral support.',
        unitAmount: rupees(9_000),
        targetQuantity: 60,
        providedQuantity: 31,
        status: 'active',
        maxPerDonation: 24,
        image: { seed: 'product-clinic-day', alt: 'A mobile clinic vehicle parked in a village' },
      },
    ],
    updates: [
      {
        id: 'u1',
        title: 'Clinic route extended to four additional villages',
        body: 'Following a request from the block health officer, the monthly route now includes four villages in the north of the district. This adds roughly 900 people to the catchment.',
        publishedAt: '2026-08-05T00:00:00+05:30',
        media: {
          seed: 'update-clinic-1',
          alt: 'The mobile clinic team preparing for a village visit',
        },
      },
    ],
    // No attached documents: the fallback fixtures describe campaigns, and a
    // document is a real file in a real bucket (Phase 10.10).
    documents: [],
    faqs: [
      {
        question: 'Who staffs the clinic?',
        answer:
          'A medical officer, a nurse and a pharmacist, supported by a community health worker from each village who handles registration and follow-up.',
      },
      {
        question: 'What happens to patients who need a hospital?',
        answer:
          'The clinic arranges referral and covers transport for cases that cannot be treated in the field. Roughly four to six cases per clinic day require this.',
      },
    ],
    impactNotes: [
      { label: 'Consultations this year', value: 4120 },
      { label: 'Villages on the route', value: 26 },
      { label: 'Antenatal packages provided', value: 96 },
    ],
    cover: {
      seed: 'campaign-mobile-clinic',
      alt: 'A mobile health clinic with patients waiting under a shelter',
    },
    gallery: [
      { seed: 'campaign-clinic-2', alt: 'A doctor consulting a patient at the mobile clinic' },
      { seed: 'campaign-clinic-3', alt: 'Medicines being dispensed at a village clinic' },
    ],
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    slug: 'nutrition-support-gaya',
    title: 'Nutrition support for 300 children under five',
    shortDescription:
      'Individually tracked supplementary nutrition for children showing signs of malnutrition.',
    programName: 'Child Welfare',
    programSlug: 'child-welfare',
    category: 'Child Welfare',
    location: 'Gaya, Bihar',
    goalAmount: rupees(540_000),
    amountRaised: rupees(189_000),
    donorCount: 134,
    startsAt: '2026-07-01T00:00:00+05:30',
    endsAt: '2027-01-31T00:00:00+05:30',
    status: 'active',
    hasProducts: true,
    isFeatured: false,
    beneficiaryTarget: 300,
    beneficiariesReached: 105,
    beneficiaryContext:
      'Children under five identified as underweight or stunted during community growth screening across nine villages in Gaya district.',
    story: [
      'Malnutrition before the age of five does damage that no amount of later schooling reverses. It is also, at this stage, straightforwardly treatable — which is what makes it worth addressing now rather than managing its consequences for twenty years.',
      'Every child in this program is measured individually and tracked by name. Supplementary nutrition is provided monthly, and growth is re-measured at six-week intervals. Children who do not respond are referred for clinical assessment.',
      'We report on this program by outcome, not by quantity distributed. Kilograms of supplement handed out is not a result.',
    ],
    products: [
      {
        id: 'nutrition-month',
        name: 'One Month of Nutrition',
        description:
          'Supplementary nutrition for one child for one month, with growth measurement and follow-up.',
        unitAmount: rupees(1_800),
        targetQuantity: 300,
        providedQuantity: 105,
        status: 'active',
        maxPerDonation: 100,
        image: {
          seed: 'product-nutrition',
          alt: 'Supplementary nutrition supplies being prepared',
        },
      },
      {
        id: 'growth-screening',
        name: 'Village Growth Screening',
        description:
          'A full growth-screening round for one village, identifying children who need support.',
        unitAmount: rupees(6_000),
        targetQuantity: 18,
        providedQuantity: 9,
        status: 'active',
        maxPerDonation: 18,
        image: { seed: 'product-screening', alt: 'A health worker measuring a child’s height' },
      },
    ],
    updates: [],
    // No attached documents: the fallback fixtures describe campaigns, and a
    // document is a real file in a real bucket (Phase 10.10).
    documents: [],
    faqs: [
      {
        question: 'How do you measure whether this works?',
        answer:
          'Weight-for-age and height-for-age are recorded for each enrolled child at six-week intervals. We publish the proportion of children who move out of the underweight category, including where the figure is disappointing.',
      },
    ],
    impactNotes: [
      { label: 'Children enrolled', value: 105 },
      { label: 'Villages screened', value: 9 },
    ],
    cover: {
      seed: 'campaign-nutrition',
      alt: 'A health worker weighing a young child at a village screening',
    },
    gallery: [
      { seed: 'campaign-nutrition-2', alt: 'Nutrition supplies laid out for distribution' },
    ],
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    slug: 'tailoring-training-centre',
    title: 'Equip a tailoring training centre for 60 women',
    shortDescription:
      'Machines, materials and a trainer for a six-month certified course with placement support.',
    programName: 'Women Empowerment',
    programSlug: 'women-empowerment',
    category: 'Women Empowerment',
    location: 'Ranchi, Jharkhand',
    goalAmount: rupees(380_000),
    amountRaised: rupees(380_000),
    donorCount: 198,
    startsAt: '2026-02-01T00:00:00+05:30',
    endsAt: '2026-08-31T00:00:00+05:30',
    status: 'completed',
    hasProducts: true,
    isFeatured: false,
    beneficiaryTarget: 60,
    beneficiariesReached: 60,
    beneficiaryContext:
      'Women aged 18–45 from households in and around Namkum block, selected through existing self-help groups.',
    story: [
      'The centre opened in March with twelve machines and a full-time trainer. Sixty women completed the six-month certified course across two cohorts.',
      'Of those sixty, forty-one are now earning: twenty-three through a shared production unit taking bulk orders, and eighteen working independently from home. The remaining nineteen are either still in placement discussions or chose not to continue.',
      'We publish the nineteen as well as the forty-one, because a program that only reports its successes is not reporting.',
    ],
    products: [
      {
        id: 'sewing-machine',
        name: 'Sewing Machine',
        description: 'One industrial sewing machine for the training centre.',
        unitAmount: rupees(12_000),
        targetQuantity: 12,
        providedQuantity: 12,
        status: 'fulfilled',
        maxPerDonation: 12,
        image: { seed: 'product-sewing-machine', alt: 'An industrial sewing machine' },
      },
      {
        id: 'training-place',
        name: 'One Training Place',
        description: 'A full six-month course place for one woman, including materials.',
        unitAmount: rupees(3_800),
        targetQuantity: 60,
        providedQuantity: 60,
        status: 'fulfilled',
        maxPerDonation: 60,
        image: {
          seed: 'product-training-place',
          alt: 'A trainee learning to use a sewing machine',
        },
      },
    ],
    updates: [
      {
        id: 'u1',
        title: 'Second cohort graduates; 41 of 60 now earning',
        body: 'The second cohort completed the course in August. Across both cohorts, forty-one of sixty participants are earning income six weeks after completion. We will follow up again at six months and publish that figure whatever it shows.',
        publishedAt: '2026-09-02T00:00:00+05:30',
        media: {
          seed: 'update-tailoring-1',
          alt: 'Graduates of the tailoring course with their certificates',
        },
      },
    ],
    // No attached documents: the fallback fixtures describe campaigns, and a
    // document is a real file in a real bucket (Phase 10.10).
    documents: [],
    faqs: [],
    impactNotes: [
      { label: 'Women trained', value: 60 },
      { label: 'Earning after six weeks', value: 41 },
      { label: 'Machines installed', value: 12 },
    ],
    cover: {
      seed: 'campaign-tailoring',
      alt: 'Women working at sewing machines in a training centre',
    },
    gallery: [
      { seed: 'campaign-tailoring-2', alt: 'A trainer demonstrating a stitching technique' },
      { seed: 'campaign-tailoring-3', alt: 'Finished garments from the production unit' },
    ],
  },
  {
    id: '00000000-0000-4000-8000-000000000005',
    slug: 'winter-relief-kalahandi',
    title: 'Winter relief for families in Kalahandi',
    shortDescription: 'Blankets and warm clothing for households ahead of the cold season.',
    programName: 'Child Welfare',
    programSlug: 'child-welfare',
    category: 'Disaster Relief',
    location: 'Kalahandi, Odisha',
    goalAmount: rupees(260_000),
    amountRaised: rupees(41_600),
    donorCount: 38,
    startsAt: '2026-09-15T00:00:00+05:30',
    endsAt: '2026-12-15T00:00:00+05:30',
    status: 'active',
    hasProducts: true,
    isFeatured: false,
    beneficiaryTarget: 400,
    beneficiariesReached: 64,
    beneficiaryContext:
      'Households in high-altitude blocks of Kalahandi where night temperatures fall sharply between December and February.',
    story: [
      'Kalahandi is not a district people associate with cold, which is part of the problem. Night temperatures in the higher blocks fall to single figures between December and February, and housing is built for heat rather than for it.',
      'This is a straightforward distribution campaign: blankets and warm clothing, delivered before the cold sets in rather than during it.',
    ],
    products: [
      {
        id: 'blanket-set',
        name: 'Blanket Set',
        description: 'Two heavy blankets for one household.',
        unitAmount: rupees(650),
        targetQuantity: 400,
        providedQuantity: 64,
        status: 'active',
        maxPerDonation: 200,
        image: { seed: 'product-blankets', alt: 'Folded blankets ready for distribution' },
      },
    ],
    updates: [],
    // No attached documents: the fallback fixtures describe campaigns, and a
    // document is a real file in a real bucket (Phase 10.10).
    documents: [],
    faqs: [],
    impactNotes: [{ label: 'Households reached', value: 64 }],
    cover: { seed: 'campaign-winter', alt: 'Blankets being distributed to families' },
    gallery: [],
  },
  {
    id: '00000000-0000-4000-8000-000000000006',
    slug: 'water-recharge-structures',
    title: 'Build ten water recharge structures',
    shortDescription:
      'Check dams and recharge pits sited by village water committees in water-stressed blocks.',
    programName: 'Environment',
    programSlug: 'environment',
    category: 'Environment',
    location: 'Kalahandi, Odisha',
    goalAmount: rupees(850_000),
    amountRaised: rupees(212_500),
    donorCount: 76,
    startsAt: '2026-08-01T00:00:00+05:30',
    endsAt: null,
    status: 'active',
    hasProducts: false,
    isFeatured: false,
    beneficiaryTarget: 1200,
    beneficiariesReached: 240,
    beneficiaryContext:
      'Farming households across six villages where the water table has fallen below the reach of existing wells.',
    story: [
      'The sites for these structures were chosen by village water committees, not by us. That is deliberate: the committees know where water is lost, and a structure the village did not ask for is a structure nobody maintains.',
      'Two of the ten are complete. This campaign has no fixed end date because construction depends on the monsoon calendar rather than on a fundraising deadline, and we would rather say that than invent urgency.',
    ],
    products: [],
    updates: [
      {
        id: 'u1',
        title: 'First two check dams complete before the monsoon',
        body: 'Construction finished on two structures in the last week of August. Water levels in adjacent wells will be measured through the dry season and published.',
        publishedAt: '2026-08-30T00:00:00+05:30',
      },
    ],
    // No attached documents: the fallback fixtures describe campaigns, and a
    // document is a real file in a real bucket (Phase 10.10).
    documents: [],
    faqs: [],
    impactNotes: [
      { label: 'Structures completed', value: 2 },
      { label: 'Households in catchment', value: 240 },
    ],
    cover: { seed: 'campaign-water', alt: 'A newly constructed check dam holding water' },
    gallery: [],
  },
];

export function getCampaign(slug: string): Campaign | undefined {
  return campaigns.find((campaign) => campaign.slug === slug);
}

export function getFeaturedCampaign(): Campaign | undefined {
  return campaigns.find((campaign) => campaign.isFeatured && campaign.status === 'active');
}

export function getCampaignsByProgram(programSlug: string): Campaign[] {
  return campaigns.filter((campaign) => campaign.programSlug === programSlug);
}

/** Distinct values for the listing filters, derived rather than hand-maintained. */
export const campaignCategories = Array.from(
  new Set(campaigns.map((campaign) => campaign.category)),
).sort();

export const campaignLocations = Array.from(
  new Set(
    campaigns.map((campaign) => campaign.location).filter((value): value is string => !!value),
  ),
).sort();
