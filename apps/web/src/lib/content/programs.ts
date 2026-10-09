import 'server-only';

import type { Program } from '@/lib/mock/types';
import { campaigns as campaignFixtures } from '@/lib/mock/campaigns';
import { programs as programFixtures, type ProgramFixture } from '@/lib/mock/programs';
import { countOpenCampaigns } from '@/lib/open-campaigns';

import { loadContent, publicCache, toMedia, type Paginated } from './source';

/**
 * Programs, from the API.
 *
 * The mapper is the whole point of this file: the API speaks the database's
 * language (`title`, `campaignCount`, `coverImage`) and the components speak
 * the page's (`name`, `activeCampaignCount`, `cover`). Keeping the translation
 * here means neither side has to bend to the other, and a column rename is one
 * edit rather than twenty.
 */

interface ApiProgramSummary {
  id: string;
  title: string;
  slug: string;
  tagline: string | null;
  shortDescription: string | null;
  coverImage: string | null;
  category: string | null;
  campaignCount: number;
  displayOrder: number;
  accentIcon: string | null;
}

interface ApiProgramDetail extends ApiProgramSummary {
  description: string | null;
  problem: string | null;
  approach: string | null;
  beneficiaries: string | null;
  goals: { title: string; description: string }[] | null;
  activities: { title: string; description: string }[] | null;
  metrics: { label: string; value: number; unit?: string }[] | null;
  locations: { district: string; state: string }[] | null;
}

const ACCENT_ICONS = ['book', 'heart', 'shield', 'sprout', 'briefcase', 'leaf', 'paw'] as const;
type AccentIcon = (typeof ACCENT_ICONS)[number];

function accentIcon(value: string | null): AccentIcon {
  return (ACCENT_ICONS as readonly string[]).includes(value ?? '')
    ? (value as AccentIcon)
    : 'sprout';
}

/**
 * A fixture programme with its open-campaign count DERIVED from the campaign
 * fixtures, by the same rule the API counts with. Fallback only.
 */
function fromFixture(fixture: ProgramFixture): Program {
  return {
    ...fixture,
    // The fixtures carry no area; in the database each programme's is its name.
    category: fixture.category ?? fixture.name,
    activeCampaignCount: countOpenCampaigns(fixture.slug, campaignFixtures),
  };
}

function findFixture(slug: string): Program | null {
  const fixture = programFixtures.find((program) => program.slug === slug);
  return fixture ? fromFixture(fixture) : null;
}

function toProgram(row: ApiProgramSummary | ApiProgramDetail): Program {
  const detail = row as Partial<ApiProgramDetail>;

  return {
    slug: row.slug,
    name: row.title,
    tagline: row.tagline ?? '',
    shortDescription: row.shortDescription ?? '',
    activeCampaignCount: row.campaignCount,
    cover: toMedia(row.coverImage, `program-${row.slug}`, `${row.title} program`),
    accentIcon: accentIcon(row.accentIcon),
    category: row.category?.trim() || null,

    // Editorial fields. A program the CMS has not filled in yet renders the
    // section empty rather than inventing one — decision A14 applies to prose
    // as much as to statistics.
    problem: detail.problem ?? '',
    approach: detail.approach ?? '',
    beneficiaries: detail.beneficiaries ?? '',
    goals: detail.goals ?? [],
    activities: detail.activities ?? [],
    metrics: detail.metrics ?? [],
    locations: detail.locations ?? [],
  };
}

export async function getPrograms(): Promise<Program[]> {
  return loadContent({
    label: 'programs',
    fromApi: async (api) => {
      const page = await api.get<Paginated<ApiProgramSummary>>('programs', {
        query: { limit: 100, sort: 'displayOrder' },
        ...publicCache('programs'),
      });
      return page.items.map(toProgram);
    },
    fallback: () => programFixtures.map(fromFixture),
  });
}

/**
 * A program with everything its page shows.
 *
 * ONE request, not four. The API already returns a program's campaigns,
 * stories and impact updates alongside it, because they are always rendered
 * together — issuing four round trips to rebuild what one query already
 * answered would be slower for no gain.
 */
export interface ProgramPage {
  program: Program;
  campaigns: ProgramCampaign[];
  stories: ProgramStory[];
  impactUpdates: ProgramImpactUpdate[];
}

export interface ProgramCampaign {
  slug: string;
  title: string;
  shortDescription: string | null;
  status: string;
}

export interface ProgramStory {
  slug: string;
  title: string;
  excerpt: string | null;
}

/**
 * An impact update, in the page's vocabulary rather than the table's.
 *
 * The database calls these `description` and `impact_date`; the page calls them
 * `body` and `occurredOn`. Translating here rather than renaming either side
 * keeps the schema readable as a schema and the component readable as a
 * component.
 */
export interface ProgramImpactUpdate {
  id: string;
  title: string;
  body: string;
  occurredOn: string;
  location: string | null;
  metricValue: number | null;
  metricUnit: string | null;
  /** How the figure was established. Null means it is not independently verified. */
  verificationMethod: string | null;
}

interface ApiImpactUpdate {
  id: string;
  title: string;
  description: string;
  impactDate: string;
  location: string | null;
  metricValue: number | null;
  metricUnit: string | null;
  verificationMethod: string | null;
}

function toImpactUpdate(row: ApiImpactUpdate): ProgramImpactUpdate {
  return {
    id: row.id,
    title: row.title,
    body: row.description,
    occurredOn: row.impactDate,
    location: row.location,
    metricValue: row.metricValue,
    metricUnit: row.metricUnit,
    verificationMethod: row.verificationMethod,
  };
}

export async function getProgram(slug: string): Promise<Program | null> {
  return loadContent({
    label: `programs/${slug}`,
    fromApi: async (api) => {
      try {
        const row = await api.get<ApiProgramDetail>(
          `programs/${slug}`,
          publicCache(`program-${slug}`),
        );
        return toProgram(row);
      } catch (error) {
        // A 404 is an ANSWER, not a failure — it must not trigger the
        // development fallback, or a slug that genuinely does not exist would
        // resolve to a fixture and the 404 page would never be seen.
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    fallback: () => findFixture(slug),
  });
}

export async function getProgramPage(slug: string): Promise<ProgramPage | null> {
  return loadContent({
    label: `programs/${slug}#page`,
    fromApi: async (api) => {
      try {
        const row = await api.get<
          ApiProgramDetail & {
            campaigns: ProgramCampaign[];
            stories: ProgramStory[];
            impactUpdates: ApiImpactUpdate[];
          }
        >(`programs/${slug}`, publicCache(`program-${slug}`));

        return {
          program: toProgram(row),
          campaigns: row.campaigns ?? [],
          stories: row.stories ?? [],
          impactUpdates: (row.impactUpdates ?? []).map(toImpactUpdate),
        };
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    fallback: () => {
      const program = findFixture(slug);
      return program ? { program, campaigns: [], stories: [], impactUpdates: [] } : null;
    },
  });
}

export function isNotFound(error: unknown): boolean {
  return (error as { status?: number })?.status === 404;
}
