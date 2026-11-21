import { describe, expect, it } from 'vitest';

import { campaigns } from '@/lib/mock/campaigns';
import type { Campaign } from '@/lib/mock/types';

import { campaignFaqsWithDefaults } from '../campaign-default-faqs';

/*
  Every campaign ends its FAQs with five general questions, modelled on a
  peer's list and rewritten to records only (owner, 2026-11-21). The owner
  removed "Can I give every month?" and the three campaign-specific ones.
*/

const BASE = campaigns[0]!;
const SITE = {
  organisationName: 'Sailent Foundation',
  programmes: ['Education', 'Healthcare'],
  causes: ['Education', 'Animal Welfare'],
};

function build(overrides: Partial<Campaign> = {}, site = SITE) {
  return campaignFaqsWithDefaults({ ...BASE, faqs: [], ...overrides }, site);
}

describe('campaignFaqsWithDefaults', () => {
  it('gives every campaign the five general questions, in order', () => {
    expect(build().map((faq) => faq.question)).toEqual([
      'What is Sailent Foundation?',
      'How do I know my donation is used well?',
      'What causes can I support?',
      'Do I get a tax benefit on my donation?',
      'Besides donating, how else can I help?',
    ]);
  });

  it('no longer has the questions the owner removed', () => {
    const questions = build()
      .map((faq) => faq.question)
      .join(' | ');
    expect(questions).not.toMatch(
      /every month|still needed|until when|where does this campaign work|pay for/i,
    );
  });

  it('says only what the site can stand behind', () => {
    const text = build()
      .map((faq) => `${faq.question} ${faq.answer}`)
      .join(' ');
    expect(text).toContain(
      'Relief is claimed through Form 10BE, issued after our annual Form 10BD filing.',
    );
    expect(text).toContain(
      'Sailent Foundation is an Indian NGO. Its programmes are Education and Healthcare',
    );
    expect(text).toContain('Education and Animal Welfare.');
    for (const claim of [
      /trusted/i,
      /100%/,
      /verified/i,
      /80G certif/i,
      /refund/i,
      /partner/i,
      /deduction/i,
    ]) {
      expect(text).not.toMatch(claim);
    }
  });

  it('names progress updates and documents only when the campaign has them', () => {
    const none = build({ updates: [], documents: [] }).find((faq) =>
      /used well/.test(faq.question),
    )!;
    expect(none.answer).toBe(
      'This page shows how much has been raised so far. You also receive a receipt by email for every donation.',
    );
    const some = build({
      updates: [{ id: 'u', title: 't', body: 'b', publishedAt: '2026-11-01' }],
    }).find((faq) => /used well/.test(faq.question))!;
    expect(some.answer).toContain('the progress updates we publish for this campaign');
  });

  it('keeps the campaign’s own FAQs first, gives way on the same topic, and leaves out causes when there are none', () => {
    const own = [
      { question: 'Will I get a receipt?', answer: 'Yes.' },
      { question: 'Is my donation eligible for tax deduction under Section 80G?', answer: 'x' },
    ];
    const faqs = build({ faqs: own }, { ...SITE, causes: [] });
    expect(faqs.slice(0, 2)).toEqual(own);
    const questions = faqs.map((faq) => faq.question);
    expect(questions).not.toContain('Do I get a tax benefit on my donation?');
    expect(questions).not.toContain('What causes can I support?');
    expect(questions).toHaveLength(5); // own two, then about, used well, other ways
  });
});
