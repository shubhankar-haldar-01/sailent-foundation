import 'server-only';

import { faqCategories, faqs as faqFixtures } from '@/lib/mock/faqs';

import { loadContent, publicCache } from './source';

export interface FaqGroup {
  id: string;
  label: string;
  description: string;
  items: { id: string; question: string; answer: string }[];
}

/**
 * The general FAQs for /faq (Phase 13): published ones only, from the API.
 *
 * The fixtures are a development fallback for when the API is unreachable
 * and mock data is on — never in production.
 */
export async function getGeneralFaqs(): Promise<FaqGroup[]> {
  return loadContent<FaqGroup[]>({
    label: 'faqs',
    fromApi: (api) => api.get<FaqGroup[]>('faqs', publicCache('faqs')),
    fallback: () =>
      faqCategories
        .map((category) => ({
          id: category.id,
          label: category.label,
          description: category.description,
          items: faqFixtures
            .filter((faq) => faq.category === category.id)
            .map(({ id, question, answer }) => ({ id, question, answer })),
        }))
        .filter((group) => group.items.length > 0),
  });
}
