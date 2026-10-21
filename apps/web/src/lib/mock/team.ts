import type { TeamMember } from './types';

/**
 * Team fixtures matching the approved Sailent Foundation Team Directory design.
 */
export const teamMembers: TeamMember[] = [
  // ── Leadership Team ────────────────────────────────────────────────────────
  {
    slug: 'shubhankar-haldar',
    name: 'Shubhankar Haldar',
    designation: 'Co-Founder & Director',
    department: 'Leadership',
    memberType: 'staff',
    displayOrder: 1,
    bio: 'Passionate about technology and social impact. Focuses on building sustainable solutions for stronger communities.',
    photo: {
      url: '/images/team-shubhankar-haldar.webp',
      seed: 'team-shubhankar',
      alt: 'Portrait of Shubhankar Haldar',
    },
    socialLinks: [
      { label: 'LinkedIn', url: 'https://linkedin.com' },
      { label: 'X', url: 'https://x.com' },
      { label: 'Email', url: 'mailto:shubhankar@sailent.org' },
    ],
  },
  {
    slug: 'varun-haldhar',
    name: 'Varun Haldhar',
    designation: 'Co-Founder & Director',
    department: 'Leadership',
    memberType: 'staff',
    displayOrder: 2,
    bio: 'Drives strategy, partnerships, and program growth. Believes in the power of collaboration to create positive change.',
    photo: {
      url: '/images/team-varun-haldhar.webp',
      seed: 'team-varun',
      alt: 'Portrait of Varun Haldhar',
    },
    socialLinks: [
      { label: 'LinkedIn', url: 'https://linkedin.com' },
      { label: 'X', url: 'https://x.com' },
      { label: 'Email', url: 'mailto:varun@sailent.org' },
    ],
  },
  {
    slug: 'anjali-verma',
    name: 'Anjali Verma',
    designation: 'Program Director',
    department: 'Leadership',
    memberType: 'staff',
    displayOrder: 3,
    bio: 'Leads program implementation and community engagement. Dedicated to education and women empowerment.',
    photo: {
      url: '/images/team-anjali-verma.webp',
      seed: 'team-anjali',
      alt: 'Portrait of Anjali Verma',
    },
    socialLinks: [
      { label: 'LinkedIn', url: 'https://linkedin.com' },
      { label: 'X', url: 'https://x.com' },
      { label: 'Email', url: 'mailto:anjali@sailent.org' },
    ],
  },
  {
    slug: 'rohit-singh',
    name: 'Rohit Singh',
    designation: 'Operations Manager',
    department: 'Leadership',
    memberType: 'staff',
    displayOrder: 4,
    bio: 'Manages day-to-day operations and ensures smooth program execution in the field.',
    photo: {
      url: '/images/team-rohit-singh.webp',
      seed: 'team-rohit',
      alt: 'Portrait of Rohit Singh',
    },
    socialLinks: [
      { label: 'LinkedIn', url: 'https://linkedin.com' },
      { label: 'X', url: 'https://x.com' },
      { label: 'Email', url: 'mailto:rohit@sailent.org' },
    ],
  },

  // ── Our Team (Programmes, Community Outreach, Operations) ──────────────────
  {
    slug: 'priya-mehta',
    name: 'Priya Mehta',
    designation: 'Communications Lead',
    department: 'Programmes',
    memberType: 'staff',
    displayOrder: 5,
    bio: 'Handles content, storytelling, and awareness campaigns.',
    photo: {
      url: '/images/team-priya-mehta.webp',
      seed: 'team-priya',
      alt: 'Portrait of Priya Mehta',
    },
    socialLinks: [
      { label: 'LinkedIn', url: 'https://linkedin.com' },
      { label: 'X', url: 'https://x.com' },
      { label: 'Email', url: 'mailto:priya@sailent.org' },
    ],
  },
  {
    slug: 'karan-joshi',
    name: 'Karan Joshi',
    designation: 'Program Associate',
    department: 'Programmes',
    memberType: 'staff',
    displayOrder: 6,
    bio: 'Supports field operations and program activities.',
    photo: {
      url: '/images/team-karan-joshi.webp',
      seed: 'team-karan',
      alt: 'Portrait of Karan Joshi',
    },
    socialLinks: [
      { label: 'LinkedIn', url: 'https://linkedin.com' },
      { label: 'X', url: 'https://x.com' },
      { label: 'Email', url: 'mailto:karan@sailent.org' },
    ],
  },
  {
    slug: 'neha-sharma',
    name: 'Neha Sharma',
    designation: 'Volunteer Coordinator',
    department: 'Community Outreach',
    memberType: 'staff',
    displayOrder: 7,
    bio: 'Manages volunteer programs and community engagement initiatives.',
    photo: {
      url: '/images/team-neha-sharma.webp',
      seed: 'team-neha',
      alt: 'Portrait of Neha Sharma',
    },
    socialLinks: [
      { label: 'LinkedIn', url: 'https://linkedin.com' },
      { label: 'X', url: 'https://x.com' },
      { label: 'Email', url: 'mailto:neha@sailent.org' },
    ],
  },
  {
    slug: 'amit-kumar',
    name: 'Amit Kumar',
    designation: 'Community Outreach',
    department: 'Community Outreach',
    memberType: 'staff',
    displayOrder: 8,
    bio: 'Works closely with local communities to drive meaningful impact.',
    photo: {
      url: '/images/team-amit-kumar.webp',
      seed: 'team-amit',
      alt: 'Portrait of Amit Kumar',
    },
    socialLinks: [
      { label: 'LinkedIn', url: 'https://linkedin.com' },
      { label: 'X', url: 'https://x.com' },
      { label: 'Email', url: 'mailto:amit@sailent.org' },
    ],
  },
  {
    slug: 'sneha-patel',
    name: 'Sneha Patel',
    designation: 'Education Coordinator',
    department: 'Programmes',
    memberType: 'staff',
    displayOrder: 9,
    bio: 'Supports education programs and learning initiatives for children and youth.',
    photo: {
      url: '/images/team-sneha-patel.webp',
      seed: 'team-sneha',
      alt: 'Portrait of Sneha Patel',
    },
    socialLinks: [
      { label: 'LinkedIn', url: 'https://linkedin.com' },
      { label: 'X', url: 'https://x.com' },
      { label: 'Email', url: 'mailto:sneha@sailent.org' },
    ],
  },
  {
    slug: 'vikram-rao',
    name: 'Vikram Rao',
    designation: 'Program Support',
    department: 'Operations',
    memberType: 'staff',
    displayOrder: 10,
    bio: 'Assists with field activities and program coordination.',
    photo: {
      url: '/images/team-vikram-rao.webp',
      seed: 'team-vikram',
      alt: 'Portrait of Vikram Rao',
    },
    socialLinks: [
      { label: 'LinkedIn', url: 'https://linkedin.com' },
      { label: 'X', url: 'https://x.com' },
      { label: 'Email', url: 'mailto:vikram@sailent.org' },
    ],
  },
  {
    slug: 'pooja-nair',
    name: 'Pooja Nair',
    designation: 'Healthcare Coordinator',
    department: 'Programmes',
    memberType: 'staff',
    displayOrder: 11,
    bio: 'Coordinates primary healthcare outreach and mobile medical camps.',
    photo: {
      url: '/images/team-priya-mehta.webp',
      seed: 'team-pooja',
      alt: 'Portrait of Pooja Nair',
    },
    socialLinks: [
      { label: 'LinkedIn', url: 'https://linkedin.com' },
      { label: 'X', url: 'https://x.com' },
      { label: 'Email', url: 'mailto:pooja@sailent.org' },
    ],
  },
  {
    slug: 'rahul-verma',
    name: 'Rahul Verma',
    designation: 'Field Operations Specialist',
    department: 'Operations',
    memberType: 'staff',
    displayOrder: 12,
    bio: 'Supervises regional distribution logistics and supply chain verification.',
    photo: {
      url: '/images/team-amit-kumar.webp',
      seed: 'team-rahul',
      alt: 'Portrait of Rahul Verma',
    },
    socialLinks: [
      { label: 'LinkedIn', url: 'https://linkedin.com' },
      { label: 'X', url: 'https://x.com' },
      { label: 'Email', url: 'mailto:rahul@sailent.org' },
    ],
  },
  {
    slug: 'deepa-sen',
    name: 'Deepa Sen',
    designation: 'Partnership Specialist',
    department: 'Community Outreach',
    memberType: 'staff',
    displayOrder: 13,
    bio: 'Bridges grassroots institutions and local self-help groups with resource partners.',
    photo: {
      url: '/images/team-sneha-patel.webp',
      seed: 'team-deepa',
      alt: 'Portrait of Deepa Sen',
    },
    socialLinks: [
      { label: 'LinkedIn', url: 'https://linkedin.com' },
      { label: 'X', url: 'https://x.com' },
      { label: 'Email', url: 'mailto:deepa@sailent.org' },
    ],
  },
  {
    slug: 'rajesh-gupta',
    name: 'Rajesh Gupta',
    designation: 'Finance & Logistics',
    department: 'Operations',
    memberType: 'staff',
    displayOrder: 14,
    bio: 'Ensures transparent record-keeping, statutory audits, and grant reporting accuracy.',
    photo: {
      url: '/images/team-karan-joshi.webp',
      seed: 'team-rajesh',
      alt: 'Portrait of Rajesh Gupta',
    },
    socialLinks: [
      { label: 'LinkedIn', url: 'https://linkedin.com' },
      { label: 'X', url: 'https://x.com' },
      { label: 'Email', url: 'mailto:rajesh@sailent.org' },
    ],
  },
];

/** Departments matching the approved team directory navigation. */
export const teamDepartments = [
  'Leadership',
  'Programmes',
  'Community Outreach',
  'Operations',
] as const;

export function getTeamByDepartment(department: string): TeamMember[] {
  return teamMembers
    .filter((member) => member.department === department)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}
