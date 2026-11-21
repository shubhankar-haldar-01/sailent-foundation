import type { Campaign } from '@/lib/mock/types';

/**
 * Every campaign's FAQs: its own, then five general default questions (owner,
 * 2026-11-21).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * BUILT EACH TIME THE PAGE RENDERS, FROM RECORDS ONLY.
 *
 * Modelled on a peer's FAQ list the owner gave, rewritten to what this site
 * can stand behind: what the organisation is (its name from Admin → Settings
 * and its live programmes), how a donation is shown to be used well, the
 * causes you can support (live), tax relief (the approved Form 10BE line
 * only) and other ways to help. Nothing is stored, so nothing goes stale.
 *
 * Left out on purpose (AGENTS.md §10): "most trusted", "100% transparent",
 * "verified NGOs", "every donation comes with an 80G certification", and NGO
 * or corporate partnerships (no such programme).
 *
 * Also removed by the owner (2026-11-21), so not to be brought back without
 * them: "Can I give every month?" and the three campaign-specific defaults
 * (what it pays for, where it works and who it helps, how much is still
 * needed and until when).
 *
 * Questions written in admin come first and win: a default is dropped when an
 * admin question already covers its topic.
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface CampaignFaq {
  question: string;
  answer: string;
}

type CampaignFacts = Pick<Campaign, 'faqs' | 'updates' | 'documents'>;

/**
 * About the organisation as a whole. Records only: the name from Admin →
 * Settings, the live programmes and the causes of public campaigns.
 */
export interface SiteFacts {
  organisationName: string;
  programmes: string[];
  causes: string[];
}

/** Words that show an admin question already covers a default's topic. */
const TOPIC_WORDS = {
  about: /\b(what\s+is|who\s+(are|is))\s+(you|us|the\s+foundation|sailent)|\babout\s+(you|us)\b/i,
  usedWell:
    /\b(used\s+(well|properly|right)|transparen\w*|reports?|accountab\w*|how\s+do\s+i\s+know)\b/i,
  causes: /\b(causes?|what\s+(else\s+)?can\s+i\s+support|other\s+campaigns)\b/i,
  tax: /\b(tax|80g|10be|deduct\w*|exempt\w*)\b/i,
  otherWays:
    /\b(volunteer\w*|other\s+ways|how\s+else|besides\s+donating|apart\s+from\s+donating)\b/i,
} as const;

/** "a, b and c" */
function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function about(site: SiteFacts): CampaignFaq {
  const programmes = site.programmes.length
    ? ` Its programmes are ${list(site.programmes)}, and campaigns like this one raise the funds for their work.`
    : ' Campaigns like this one raise the funds for its work.';
  return {
    question: `What is ${site.organisationName}?`,
    answer: `${site.organisationName} is an Indian NGO.${programmes}`,
  };
}

function usedWell(campaign: CampaignFacts): CampaignFaq {
  const published = [
    'how much has been raised so far',
    ...(campaign.updates.length > 0 ? ['the progress updates we publish for this campaign'] : []),
    ...(campaign.documents.length > 0 ? ['the documents attached to it'] : []),
  ];
  return {
    question: 'How do I know my donation is used well?',
    answer: `This page shows ${list(published)}. You also receive a receipt by email for every donation.`,
  };
}

function causes(site: SiteFacts): CampaignFaq | null {
  if (site.causes.length === 0) return null;
  return {
    question: 'What causes can I support?',
    answer: `${list(site.causes)}. Every open campaign is listed on the Campaigns page.`,
  };
}

function tax(): CampaignFaq {
  return {
    question: 'Do I get a tax benefit on my donation?',
    answer: 'Relief is claimed through Form 10BE, issued after our annual Form 10BD filing.',
  };
}

function otherWays(): CampaignFaq {
  return {
    question: 'Besides donating, how else can I help?',
    answer:
      'You can volunteer with us, share this campaign with people who may want to help, or come to one of our events. The Volunteer and Events pages have the details.',
  };
}

/** The campaign's own FAQs, then the general defaults its own do not already cover. */
export function campaignFaqsWithDefaults(campaign: CampaignFacts, site: SiteFacts): CampaignFaq[] {
  const own = campaign.faqs;
  const covered = (topic: RegExp) => own.some((faq) => topic.test(faq.question));

  const defaults: (CampaignFaq | null)[] = [
    covered(TOPIC_WORDS.about) ? null : about(site),
    covered(TOPIC_WORDS.usedWell) ? null : usedWell(campaign),
    covered(TOPIC_WORDS.causes) ? null : causes(site),
    covered(TOPIC_WORDS.tax) ? null : tax(),
    covered(TOPIC_WORDS.otherWays) ? null : otherWays(),
  ];
  return [...own, ...defaults.filter((faq): faq is CampaignFaq => faq !== null)];
}
