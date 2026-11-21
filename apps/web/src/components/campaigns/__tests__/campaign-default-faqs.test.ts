import { describe, expect, it } from 'vitest';

import { campaigns } from '@/lib/mock/campaigns';
import type { Campaign } from '@/lib/mock/types';

import { campaignFaqsWithDefaults } from '../campaign-default-faqs';

/*
  Every campaign gets related FAQs, built from its own record (owner,
  2026-11-21): what it pays for, where and who it helps, how much is needed
  and until when. Nothing invented; its own FAQs first and winning.
*/

const BASE = campaigns[0]!;

function build(overrides: Partial<Campaign> = {}) {
  return campaignFaqsWithDefaults({ ...BASE, faqs: [], ...overrides });
}

describe('campaignFaqsWithDefaults', () => {
  it('gives a campaign with no FAQs of its own three questions about it', () => {
    const faqs = build({
      title: 'School Kits for Jharkhand',
      location: 'Ranchi, Jharkhand',
      programName: 'Education',
      status: 'active',
      donation: { state: 'open' },
      endsAt: '2026-11-30T00:00:00+05:30',
      progress: undefined,
      goalAmount: 45_000_000,
      amountRaised: 31_860_000,
      beneficiaryTarget: 500,
    });

    expect(faqs.map((faq) => faq.question)).toEqual([
      'What does a donation to School Kits for Jharkhand pay for?',
      'Where does this campaign work, and who does it help?',
      'How much is still needed, and until when can I give?',
    ]);
    // Its own products and prices.
    const [paysFor, whereWho, progress] = faqs;
    expect(paysFor!.answer).toContain(`${BASE.products[0]!.name} (₹`);
    // Its own place, programme and people.
    expect(whereWho!.answer).toContain(
      'It works in Ranchi, Jharkhand, as part of our Education programme.',
    );
    expect(whereWho!.answer).toContain(BASE.beneficiaryContext.slice(0, 40));
    expect(whereWho!.answer).toContain('It aims to reach 500 people.');
    // The live figures and the same end date the page header shows.
    expect(progress!.answer).toContain('₹3,18,600 has been raised of the ₹4,50,000 goal (70%).');
    expect(progress!.answer).toContain('₹1,31,400 is still needed.');
    expect(progress!.answer).toContain('The campaign ends on 30 November 2026.');
  });

  it('describes a campaign without products in its own words', () => {
    const faqs = build({
      products: [],
      supportProvides: null,
      shortDescription: 'Meals for children under five',
    });
    expect(faqs[0]).toEqual({
      question: `What does a donation to ${BASE.title} pay for?`,
      answer: 'Meals for children under five.',
    });
  });

  it('keeps the campaign’s own FAQs first, and drops a default whose topic they cover', () => {
    const own = [
      { question: 'How is the money spent?', answer: 'On kits.' },
      { question: 'Will I get a receipt?', answer: 'Yes.' },
    ];
    const faqs = build({ faqs: own });

    expect(faqs.slice(0, 2)).toEqual(own);
    expect(faqs.map((faq) => faq.question)).not.toContain(
      `What does a donation to ${BASE.title} pay for?`,
    );
    expect(faqs).toHaveLength(4); // own two, then where/who and progress
  });

  it('does not treat "Where does my money go?" as covering where the campaign works', () => {
    const faqs = build({ faqs: [{ question: 'Where does my money go?', answer: 'To kits.' }] });
    const questions = faqs.map((faq) => faq.question);
    expect(questions).toContain('Where does this campaign work, and who does it help?');
    expect(questions).not.toContain(`What does a donation to ${BASE.title} pay for?`);
  });

  it('says a finished or paused campaign is not taking donations, and invents nothing missing', () => {
    const ended = build({
      status: 'completed',
      progress: undefined,
      goalAmount: 1_000_000,
      amountRaised: 1_000_000,
    });
    expect(ended.at(-1)).toEqual({
      question: 'How much did this campaign raise?',
      answer:
        '₹10,000 has been raised of the ₹10,000 goal (100%). It is no longer accepting donations.',
    });

    const paused = build({ status: 'paused' });
    expect(paused.at(-1)!.answer).toMatch(/Donations are paused for now\.$/);

    const bare = build({
      location: null,
      beneficiaryContext: '',
      goalAmount: 0,
      progress: undefined,
    });
    expect(bare.map((faq) => faq.question)).toEqual([
      `What does a donation to ${BASE.title} pay for?`,
    ]);
  });
});
