import type { Metadata } from 'next';

import { siteConfig } from '../site-config';

/**
 * Metadata helpers (docs/seo-strategy.md).
 *
 * Titles put the DISTINGUISHING words first. A title whose first forty
 * characters are the organization name wastes the whole of a mobile SERP line.
 */

export interface PageMetadataInput {
  /** Replaces the generated `Page — Site` title outright. */
  titleOverride?: string;
  title: string;
  description?: string;
  path: string;
  image?: { url: string; alt: string };
  type?: 'website' | 'article';
  publishedAt?: string;
  modifiedAt?: string;
  /** Transactional and private routes must not be indexed. */
  noIndex?: boolean;
  /**
   * Point the canonical somewhere other than this page.
   *
   * For content FIRST PUBLISHED ELSEWHERE — a blog post syndicated from a
   * partner's site, say — where the original should carry the ranking. It is
   * opt-in and normally unset: a page is its own canonical, which is both the
   * honest default and what every other route here wants.
   */
  canonicalOverride?: string;
}

export function buildMetadata(input: PageMetadataInput): Metadata {
  const canonical = input.canonicalOverride ?? canonicalUrl(input.path);
  const title = input.titleOverride ?? `${input.title} — ${siteConfig.name}`;

  return {
    /**
     * `absolute`, so the root layout's `%s — Sailent Foundation` template does
     * not append the name a second time. Without it every page shipped
     * "… — Sailent Foundation — Sailent Foundation", which is what a search
     * result would have shown.
     */
    title: { absolute: title },
    description: input.description,
    alternates: { canonical },
    robots: input.noIndex
      ? { index: false, follow: false, nocache: true }
      : { index: true, follow: true },
    openGraph: {
      type: input.type ?? 'website',
      title,
      description: input.description,
      url: canonical,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      ...(input.image
        ? { images: [{ url: input.image.url, alt: input.image.alt, width: 1200, height: 630 }] }
        : {}),
      ...(input.publishedAt ? { publishedTime: input.publishedAt } : {}),
      ...(input.modifiedAt ? { modifiedTime: input.modifiedAt } : {}),
    },
    twitter: {
      // WhatsApp is the primary sharing channel in this market and is stricter
      // about image size than Facebook, so cards are tested against it
      // specifically once real imagery exists.
      card: 'summary_large_image',
      title,
      description: input.description,
      ...(input.image ? { images: [input.image.url] } : {}),
    },
  };
}

/** Canonical URL. Always absolute, always without a trailing slash. */
export function canonicalUrl(path: string): string {
  const normalised = path === '/' ? '' : `/${path.replace(/^\/|\/$/g, '')}`;
  return `${siteConfig.url}${normalised}`;
}
