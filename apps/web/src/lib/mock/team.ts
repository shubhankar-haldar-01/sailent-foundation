import type { TeamMember } from './types';

/**
 * Team fixtures.
 *
 * ⚠️ DEVELOPMENT CONTENT. These are fictional people. Phase 2 must not invent
 * real staff identities, so no name, photograph or biography here refers to an
 * actual person. The organization supplies its real team before launch.
 */

export const teamMembers: TeamMember[] = [
  {
    slug: 'director',
    name: 'A. Raghavan',
    designation: 'Founder & Executive Director',
    department: 'Leadership',
    memberType: 'staff',
    displayOrder: 1,
    bio: 'Brings deep experience in community development and works closely with partners to strengthen local institutions.',
    photo: {
      url: '/images/team-a-raghavan.webp',
      seed: 'team-director',
      alt: 'Portrait of A. Raghavan',
    },
    socialLinks: [{ label: 'LinkedIn', url: 'https://example.org' }],
  },
  {
    slug: 'programs-lead',
    name: 'M. Lakshmi',
    designation: 'Head of Programmes',
    department: 'Leadership',
    memberType: 'staff',
    displayOrder: 2,
    bio: 'Leads programme design and implementation, working with communities, schools and local partners to create meaningful change.',
    photo: {
      url: '/images/team-m-lakshmi.webp',
      seed: 'team-programs',
      alt: 'Portrait of M. Lakshmi',
    },
  },
  {
    slug: 'finance-lead',
    name: 'S. Deshpande',
    designation: 'Head of Finance & Compliance',
    department: 'Leadership',
    memberType: 'staff',
    displayOrder: 3,
    bio: 'Oversees finance, compliance and governance to ensure transparency and responsible growth.',
    photo: {
      url: '/images/team-s-deshpande.webp',
      seed: 'team-finance',
      alt: 'Portrait of S. Deshpande',
    },
  },
  {
    slug: 'education-manager',
    name: 'P. Kujur',
    designation: 'Education Program Manager',
    department: 'Programs',
    memberType: 'staff',
    displayOrder: 4,
    bio: 'Runs the education program across Jharkhand and Bihar, and the school partnerships it depends on.',
    photo: { seed: 'team-education', alt: 'Portrait of the education program manager' },
  },
  {
    slug: 'health-manager',
    name: 'Dr N. Baghel',
    designation: 'Healthcare Program Manager',
    department: 'Programs',
    memberType: 'staff',
    displayOrder: 5,
    bio: 'Medical officer leading the mobile clinic program and the community health worker training.',
    photo: { seed: 'team-health', alt: 'Portrait of the healthcare program manager' },
  },
  {
    slug: 'volunteer-coordinator',
    name: 'R. Toppo',
    designation: 'Volunteer Coordinator',
    department: 'Operations',
    memberType: 'staff',
    displayOrder: 6,
    bio: 'First point of contact for volunteers, from application through to certification.',
    photo: { seed: 'team-volunteer', alt: 'Portrait of the volunteer coordinator' },
  },
  {
    slug: 'trustee-chair',
    name: 'V. Menon',
    designation: 'Chair, Board of Trustees',
    department: 'Board',
    memberType: 'trustee',
    displayOrder: 7,
    bio: 'Chairs the board and its quarterly governance review. Background in development finance.',
    photo: { seed: 'team-chair', alt: 'Portrait of the board chair' },
  },
  {
    slug: 'trustee-audit',
    name: 'K. Iyer',
    designation: 'Trustee, Audit & Risk',
    department: 'Board',
    memberType: 'trustee',
    displayOrder: 8,
    bio: 'Chairs the audit sub-committee and reviews financial controls independently of the executive team.',
    photo: { seed: 'team-audit', alt: 'Portrait of the audit trustee' },
  },
];

/** Departments in the order they should appear on /team. */
export const teamDepartments = ['Leadership', 'Programs', 'Operations', 'Board'] as const;

export function getTeamByDepartment(department: string): TeamMember[] {
  return teamMembers
    .filter((member) => member.department === department)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}
