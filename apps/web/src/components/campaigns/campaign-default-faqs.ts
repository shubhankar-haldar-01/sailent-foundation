import { formatCurrency, formatNumber } from '@sailent/ui';

import type { Campaign } from '@/lib/mock/types';

import { acceptsDonationsNow } from './campaign-status';

/**
 * Every campaign's FAQs: its own, then default questions about IT (owner,
 * 2026-11-21).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * BUILT FROM THE CAMPAIGN'S OWN RECORD, EACH TIME THE PAGE RENDERS.
 *
 * A campaign created in admin had no FAQs at all, and the seeded ones shared
 * the same two generic questions. The owner asked for related FAQs on every
 * campaign and chose three topics: what it pays for, where it works and who it
 * helps, and how much is still needed and until when.
 *
 * Every answer is made only of facts the campaign holds (its products and
 * prices, its description, location, programme, who it is for, its goal, the
 * amount raised, its end date and status), so nothing is invented (AGENTS.md
 * §12) and nothing goes stale: change a price or the end date and the answer
 * follows. A question whose facts are missing is left out.
 *
 * Questions written in admin come first and win: a default is dropped when an
 * admin question already covers its topic ("How is the money spent?" covers
 * "what it pays for").
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface CampaignFaq {
  question: string;
  answer: string;
}

type CampaignFacts = Pick<
  Campaign,
  | 'title'
  | 'shortDescription'
  | 'location'
  | 'programName'
  | 'beneficiaryContext'
  | 'beneficiaryTarget'
  | 'products'
  | 'supportProvides'
  | 'goalAmount'
  | 'amountRaised'
  | 'progress'
  | 'endsAt'
  | 'status'
  | 'donation'
  | 'faqs'
>;

/** Words that show an admin question already covers a default's topic. */
const TOPIC_WORDS = {
  paysFor:
    /\b(spent|spend|pays?\s+for|used\s+for|money\s+go(es)?|go(es)?\s+towards?|buys?|costs?)\b/i,
  // "Where does my money go?" is about money, not about the place.
  whereWho: /\bwhere\b(?!.*\bmoney\b)|\b(who\s+(does|do|will|is|are)|beneficiar\w*|locations?)\b/i,
  progress:
    /\b(goal|raised|target|deadline|until\s+when|end\s+date|ends?|closes?|progress|how\s+much\b.*\b(need|left|remain))/i,
} as const;

const endDate = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

function clean(text: string | null | undefined): string {
  return (text ?? '').trim();
}

/** "a, b and c" */
function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function sentence(text: string): string {
  const trimmed = clean(text);
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** What the campaign pays for: its products and prices, or its own words. */
function paysFor(campaign: CampaignFacts): CampaignFaq | null {
  const products = campaign.products.filter((product) => product.status !== 'inactive');
  const question = `What does a donation to ${campaign.title} pay for?`;

  if (products.length > 0) {
    const items = products.map((product) => {
      const target =
        product.targetQuantity && product.targetQuantity > 0
          ? `, ${formatNumber(product.targetQuantity)} needed in all`
          : '';
      return `${product.name} (${formatCurrency(product.unitAmount)} each${target})`;
    });
    return {
      question,
      answer:
        `You can give specific items: ${list(items)}. ` +
        'You can also give an amount of your choice to this campaign instead of, or as well as, items.',
    };
  }

  const ownWords = clean(campaign.supportProvides) || clean(campaign.shortDescription);
  return ownWords ? { question, answer: sentence(ownWords) } : null;
}

/** Where it works and who it is for, in the campaign's own words. */
function whereWho(campaign: CampaignFacts): CampaignFaq | null {
  const place = clean(campaign.location);
  const programme = clean(campaign.programName);
  const people = clean(campaign.beneficiaryContext);
  if (!place && !people) return null;

  const parts: string[] = [];
  if (place) {
    parts.push(
      programme
        ? `It works in ${place}, as part of our ${programme} programme.`
        : `It works in ${place}.`,
    );
  }
  if (people) parts.push(sentence(people));
  if (campaign.beneficiaryTarget && campaign.beneficiaryTarget > 0) {
    parts.push(`It aims to reach ${formatNumber(campaign.beneficiaryTarget)} people.`);
  }
  return {
    question: place
      ? 'Where does this campaign work, and who does it help?'
      : 'Who does this campaign help?',
    answer: parts.join(' '),
  };
}

/** The live figures: raised, goal, what remains, and the end date or status. */
function progress(campaign: CampaignFacts): CampaignFaq | null {
  const goal = campaign.progress?.goal ?? campaign.goalAmount;
  const raised = campaign.progress?.raised ?? campaign.amountRaised;
  if (!goal || goal <= 0) return null;

  const percent = campaign.progress?.percent ?? Math.floor((raised / goal) * 100);
  const figures = `${formatCurrency(raised)} has been raised of the ${formatCurrency(goal)} goal (${percent}%).`;
  const ends = campaign.endsAt ? endDate.format(new Date(campaign.endsAt)) : null;

  if (campaign.status === 'paused') {
    return {
      question: 'How much has been raised, and can I still give?',
      answer: `${figures} Donations are paused for now.`,
    };
  }
  if (!acceptsDonationsNow(campaign)) {
    return {
      question: 'How much did this campaign raise?',
      answer: `${figures} It is no longer accepting donations.`,
    };
  }

  const remaining = Math.max(0, goal - raised);
  const need =
    remaining > 0
      ? `${formatCurrency(remaining)} is still needed.`
      : 'The goal has been reached, and the campaign is still accepting donations.';
  const deadline = ends ? `The campaign ends on ${ends}.` : 'It has no end date.';
  return {
    question: 'How much is still needed, and until when can I give?',
    answer: `${figures} ${need} ${deadline}`,
  };
}

/** The campaign's own FAQs, followed by the default ones its own do not already cover. */
export function campaignFaqsWithDefaults(campaign: CampaignFacts): CampaignFaq[] {
  const own = campaign.faqs;
  const covered = (topic: RegExp) => own.some((faq) => topic.test(faq.question));

  const defaults: (CampaignFaq | null)[] = [
    covered(TOPIC_WORDS.paysFor) ? null : paysFor(campaign),
    covered(TOPIC_WORDS.whereWho) ? null : whereWho(campaign),
    covered(TOPIC_WORDS.progress) ? null : progress(campaign),
  ];
  return [...own, ...defaults.filter((faq): faq is CampaignFaq => faq !== null)];
}
