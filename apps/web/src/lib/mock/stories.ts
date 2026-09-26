import type { Story } from './types';

/**
 * Success story fixtures.
 *
 * ⚠️ DEVELOPMENT CONTENT. These are illustrative narratives, not accounts of
 * real people. Names are fictional.
 *
 * Every story carries `consentRecorded` because Phase 0 blocks publishing a
 * story that names an identifiable person without recorded consent — the most
 * serious ethical risk in the product, and cheap to prevent in the data model.
 */

export const stories: Story[] = [
  {
    slug: 'sunita-finished-school',
    title: 'Sunita finished school. Her sister will too.',
    summary:
      'A uniform and a bus pass were the difference between leaving after class eight and sitting the board exams.',
    subjectName: 'Sunita',
    location: 'Ranchi, Jharkhand',
    programName: 'Education',
    programSlug: 'education',
    campaignSlug: 'school-kits-jharkhand',
    publishedAt: '2026-08-12T00:00:00+05:30',
    consentRecorded: true,
    isFeatured: true,
    challenge:
      'Sunita passed class eight near the top of her year. The nearest secondary school was eleven kilometres away, which meant a bus fare her family could not commit to across two daughters. The decision her parents faced was not whether education mattered — it was which child would continue.',
    intervention:
      'A head teacher at her primary school flagged her case during a routine conversation about students at risk of dropping out. She received a school kit and a uniform at the start of the academic year, and was enrolled in the transport support that covers the bus fare for students travelling more than five kilometres.',
    journey:
      'The first year was not smooth. She missed six weeks during the harvest, which is normal here and which the after-school sessions exist to absorb. She caught up in mathematics, which she had been behind in since class six, and stayed ahead in everything else. Her attendance over the second year was ninety-one per cent.',
    outcome:
      'Sunita sat her class ten board examinations in March and passed in the first division. She has enrolled in the higher secondary school in the same town and intends to sit the nursing entrance examination.',
    impact:
      'Her younger sister started class six this year and is enrolled in the same support program. Her parents did not have to choose between them. That is the outcome that matters most, and it is the one that is hardest to put in a statistic.',
    cover: {
      seed: 'story-sunita',
      alt: 'A secondary school student in uniform outside her school',
    },
    gallery: [
      { seed: 'story-sunita-2', alt: 'Students walking to school along a rural road' },
      { seed: 'story-sunita-3', alt: 'A classroom during a mathematics lesson' },
    ],
  },
  {
    slug: 'clinic-day-in-kondagaon',
    title: 'What a clinic day actually looks like',
    summary:
      'Sixty-one patients, four referrals and one conversation that changed how we schedule visits.',
    subjectName: null,
    location: 'Bastar, Chhattisgarh',
    programName: 'Healthcare',
    programSlug: 'healthcare',
    campaignSlug: 'mobile-health-clinic-bastar',
    publishedAt: '2026-07-28T00:00:00+05:30',
    consentRecorded: true,
    isFeatured: true,
    challenge:
      'The mobile clinic had been running the same route for eight months with steady attendance, and we assumed that meant it was working. Attendance is not the same as access, and the gap between them only became visible when we started asking who was not coming.',
    intervention:
      'On a clinic day in June the team ran a short survey alongside consultations, asking each patient who else in their household had needed care in the previous month and had not received it. The answers pointed consistently in one direction: elderly household members who could not walk the distance to the clinic point.',
    journey:
      'The clinic had been setting up at the village centre, which is sensible for most people and impossible for some. The team began allocating the last ninety minutes of each visit to household calls for patients identified in advance by the community health worker.',
    outcome:
      'Household visits now account for roughly twelve patients per clinic day — people who had been getting no care at all rather than inadequate care. Total consultations rose by about a fifth without adding a clinic day.',
    impact:
      'This is included here because it was a design failure we did not notice for eight months. Steady attendance made the program look like it was working, and it took deliberately asking about absence to find out who it was missing.',
    cover: { seed: 'story-clinic', alt: 'A doctor consulting a patient at a village clinic' },
    gallery: [{ seed: 'story-clinic-2', alt: 'A health worker visiting a patient at home' }],
  },
  {
    slug: 'production-unit-first-order',
    title: 'The first bulk order, and what nearly went wrong',
    summary:
      'Twenty-three women took on a 400-garment order. Pricing it correctly mattered more than sewing it.',
    subjectName: null,
    location: 'Ranchi, Jharkhand',
    programName: 'Women Empowerment',
    programSlug: 'women-empowerment',
    campaignSlug: 'tailoring-training-centre',
    publishedAt: '2026-09-05T00:00:00+05:30',
    consentRecorded: true,
    isFeatured: false,
    challenge:
      'The production unit received its first bulk enquiry in July: four hundred uniform sets for a school chain, to be delivered in six weeks. The group had the skill and the machines. What they did not have was any basis for quoting a price.',
    intervention:
      'The mentoring component exists for exactly this. Two sessions were spent costing the order properly — material, thread, machine time, electricity, wastage, and the labour of twenty-three people — before anybody quoted a figure.',
    journey:
      'The group’s instinct had been to quote low to secure the order. Costed properly, that price would have left them earning below the local daily wage for six weeks of work. The quote went out roughly a third higher. The buyer negotiated, and accepted.',
    outcome:
      'The order was delivered two days early. Each participant earned the equivalent of about six weeks of local daily wages, and the unit has since taken two repeat orders from the same buyer at the same rate.',
    impact:
      'The sewing was never the constraint. Knowing what the work was worth was the constraint, and it is the part that is easy to leave out of a training program.',
    cover: { seed: 'story-production', alt: 'Women working together in a garment production unit' },
    gallery: [],
  },
  {
    slug: 'reading-corner-attendance',
    title: 'A bookshelf is not an intervention. This one worked anyway.',
    summary:
      'We installed reading corners expecting little. The measurable change was in something we were not tracking.',
    subjectName: null,
    location: 'Ranchi, Jharkhand',
    programName: 'Education',
    programSlug: 'education',
    campaignSlug: 'school-kits-jharkhand',
    publishedAt: '2026-09-01T00:00:00+05:30',
    consentRecorded: true,
    isFeatured: false,
    challenge:
      'Reading corners were the smallest component of the education program and the one we were least confident about. A shelf of storybooks in a classroom is the kind of thing that photographs well and changes nothing.',
    intervention:
      'Fourteen classrooms received a shelf and roughly sixty age-graded titles in Hindi and English, with one orientation session for teachers on using them during the school day rather than keeping them locked away.',
    journey:
      'Reading assessment scores did not move measurably over a single term, which is roughly what we expected. What did move was attendance in the final period of the day, which teachers had allocated to the reading corner.',
    outcome:
      'Across the fourteen schools, final-period attendance rose noticeably over the term. Reading ability may well follow, but we have no evidence of it yet and will not claim it.',
    impact:
      'The honest summary is that we do not fully know why this worked, and one term is too short to conclude much. We are tracking it for a full year before deciding whether to expand it.',
    cover: {
      seed: 'story-reading',
      alt: 'Children choosing books from a classroom reading corner',
    },
    gallery: [],
  },
  {
    slug: 'water-committee-decision',
    title: 'The village picked a different site than our engineer did',
    summary: 'They were right, and the reason is not written down anywhere we could have read.',
    subjectName: null,
    location: 'Kalahandi, Odisha',
    programName: 'Environment',
    programSlug: 'environment',
    campaignSlug: 'water-recharge-structures',
    publishedAt: '2026-08-22T00:00:00+05:30',
    consentRecorded: true,
    isFeatured: false,
    challenge:
      'A survey identified the technically optimal site for the first check dam based on catchment area and gradient. The village water committee wanted it roughly two hundred metres downstream.',
    intervention:
      'The program rule is that committees choose sites. We asked for their reasoning rather than simply deferring, which turned out to be the useful part.',
    journey:
      'The preferred site sat below a seasonal path used to move livestock in the monsoon. Construction at the surveyed point would have cut that route, and the structure would have been breached within two seasons — as had happened to an earlier government structure half a kilometre away.',
    outcome:
      'The dam was built at the committee’s site. It held through the monsoon and the livestock route is intact.',
    impact:
      'The engineering survey was not wrong. It was working from data that did not include a livestock path, which is the sort of thing that is known locally and written down nowhere.',
    cover: { seed: 'story-water', alt: 'Village committee members inspecting a water structure' },
    gallery: [],
  },
  {
    slug: 'crèche-that-let-a-mother-work',
    title: 'Childcare is an income program',
    summary:
      'The crèche was designed for the children. Its clearest measurable effect was on their mothers’ earnings.',
    subjectName: null,
    location: 'Gaya, Bihar',
    programName: 'Child Welfare',
    programSlug: 'child-welfare',
    campaignSlug: null,
    publishedAt: '2026-06-30T00:00:00+05:30',
    consentRecorded: true,
    isFeatured: false,
    challenge:
      'Community crèches were set up to address nutrition and supervision for children under six. The design assumption was that the benefit would show up in the children’s growth measurements.',
    intervention:
      'Nine crèches opened across three villages, each staffed by two trained workers and open through the working day.',
    journey:
      'Growth measurements did improve, though slowly and within the range that could be explained by the nutrition component alone. The change nobody had planned for was in how many days per month the mothers of enrolled children were able to take paid work.',
    outcome:
      'Mothers of enrolled children reported taking substantially more paid work days per month. For households at this income level, that is a meaningful difference in annual earnings.',
    impact:
      'We now describe the crèche program as serving two purposes rather than one, and measure it accordingly. It was doing that from the first month; we simply were not looking.',
    cover: { seed: 'story-creche', alt: 'Young children playing at a community crèche' },
    gallery: [],
  },
];

export function getStory(slug: string): Story | undefined {
  return stories.find((story) => story.slug === slug);
}

export function getFeaturedStory(): Story | undefined {
  return stories.find((story) => story.isFeatured);
}

export function getStoriesByProgram(programSlug: string): Story[] {
  return stories.filter((story) => story.programSlug === programSlug);
}

export function getStoriesByCampaign(campaignSlug: string): Story[] {
  return stories.filter((story) => story.campaignSlug === campaignSlug);
}
