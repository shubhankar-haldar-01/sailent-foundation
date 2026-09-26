import 'server-only';

import type { TeamMember } from '@/lib/mock/types';
import { teamMembers as teamFixtures } from '@/lib/mock/team';

import { isNotFound } from './programs';
import { loadContent, publicCache, toMedia } from './source';

interface ApiTeamMember {
  id: string;
  name: string;
  slug: string;
  photoUrl: string | null;
  designation: string | null;
  department: string | null;
  memberType: 'staff' | 'trustee' | 'advisor';
  bio: string | null;
  socialLinks: { label: string; url: string }[] | null;
  displayOrder: number;
}

/** The detail endpoint adds the two fields the directory listing leaves out. */
interface ApiTeamMemberDetail extends ApiTeamMember {
  experience: string | null;
  emailPublic: string | null;
}

function toMember(row: ApiTeamMember): TeamMember {
  return {
    slug: row.slug,
    name: row.name,
    designation: row.designation ?? '',
    department: row.department ?? '',
    memberType: row.memberType,
    displayOrder: row.displayOrder,
    bio: row.bio ?? '',
    photo: toMedia(row.photoUrl, `team-${row.slug}`, `Portrait of ${row.name}`),
    socialLinks: row.socialLinks ?? undefined,
  } as TeamMember;
}

export async function getTeam(): Promise<TeamMember[]> {
  return loadContent({
    label: 'team',
    fromApi: async (api) => {
      // Not paginated: a team directory is a handful of people, and the API
      // returns it already ordered for display.
      const rows = await api.get<ApiTeamMember[]>('team', publicCache('team'));
      return rows.map(toMember);
    },
    fallback: () => teamFixtures,
  });
}

/**
 * One team member's page.
 *
 * Falls back to the fixture directory like every other loader here, so the site
 * still renders a portrait and a biography when the API is unreachable — a
 * profile page that 404s during an outage looks like the person has left.
 */
export async function getTeamMember(slug: string): Promise<TeamMemberDetail | null> {
  return loadContent({
    label: `team/${slug}`,
    fromApi: async (api) => {
      try {
        const row = await api.get<ApiTeamMemberDetail>(`team/${slug}`, publicCache(`team-${slug}`));
        return {
          ...toMember(row),
          experience: row.experience,
          emailPublic: row.emailPublic,
        };
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    fallback: () => {
      const member = teamFixtures.find((entry) => entry.slug === slug);
      return member ? { ...member, experience: null, emailPublic: null } : null;
    },
  });
}

export interface TeamMemberDetail extends TeamMember {
  /** Prose, not a structured CV — an editor writes it as paragraphs. */
  experience: string | null;
  /**
   * A PUBLISHED address, and deliberately not everybody's.
   *
   * Most of the directory has none: this field exists for the handful of roles
   * where a public contact is genuinely useful, and every one of them is a
   * decision somebody made in the admin rather than a default.
   */
  emailPublic: string | null;
}

export async function getTeamByDepartment(department: string): Promise<TeamMember[]> {
  const team = await getTeam();
  return team
    .filter((member) => member.department === department)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Departments, in the order they appear on the page.
 *
 * Fixed rather than derived: the order is editorial (leadership first, board
 * last), and deriving it from the data would sort the board above the people
 * who run the organization day to day.
 */
export const teamDepartments = ['Leadership', 'Programs', 'Operations', 'Board'] as const;

/** Group the directory once, so a page renders every department in one pass. */
export async function getTeamGrouped(): Promise<{ department: string; members: TeamMember[] }[]> {
  const team = await getTeam();

  return teamDepartments
    .map((department) => ({
      department,
      members: team
        .filter((member) => member.department === department)
        .sort((a, b) => a.displayOrder - b.displayOrder),
    }))
    .filter((group) => group.members.length > 0);
}
