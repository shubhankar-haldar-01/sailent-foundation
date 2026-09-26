import { siteConfig } from '../site-config';
import { canonicalUrl } from './metadata';

/**
 * Structured data (docs/seo-strategy.md §5).
 *
 * Only what is true and substantiated. Misleading markup risks a manual action
 * and, for an NGO, is simply dishonest.
 *
 * DELIBERATELY NOT IMPLEMENTED, and not to be added later without a reason:
 *   • AggregateRating / Review — we have no legitimate review corpus
 *   • Product / Offer on campaign products — a school kit is not merchandise;
 *     marking it as one invites shopping-surface treatment that misrepresents
 *     a donation
 *   • DonateAction — poorly supported and easily read as a transactional claim
 */

export interface BreadcrumbEntry {
  name: string;
  path: string;
}

export function breadcrumbSchema(entries: BreadcrumbEntry[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: entries.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      item: `${siteConfig.url}${entry.path}`,
    })),
  };
}

export interface OrganizationInput {
  /**
   * Registration identifiers are OPTIONAL and omitted entirely when absent.
   * Asserting a registration we have not verified is exactly the misleading
   * markup this file exists to avoid (open question 2 in phase-0-decisions).
   */
  registrationNumber?: string;
  address?: { street: string; city: string; state: string; postalCode: string };
  email?: string;
  phone?: string;
  socialProfiles?: string[];
  logoUrl?: string;
}

export function organizationSchema(input: OrganizationInput = {}): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'NGO',
    name: siteConfig.name,
    url: siteConfig.url,
  };

  if (siteConfig.description) schema.description = siteConfig.description;
  if (input.logoUrl) schema.logo = input.logoUrl;
  if (input.socialProfiles?.length) schema.sameAs = input.socialProfiles;
  if (input.email || input.phone) {
    schema.contactPoint = {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      ...(input.email ? { email: input.email } : {}),
      ...(input.phone ? { telephone: input.phone } : {}),
    };
  }
  if (input.address) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: input.address.street,
      addressLocality: input.address.city,
      addressRegion: input.address.state,
      postalCode: input.address.postalCode,
      addressCountry: 'IN',
    };
  }

  return schema;
}

/** Renders a schema object as a JSON-LD script tag payload. */
export function jsonLd(schema: Record<string, unknown>): { __html: string } {
  return { __html: JSON.stringify(schema) };
}

/**
 * `BlogPosting`, for a real article.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * EVERY FIELD HERE COMES FROM A DATABASE COLUMN. Nothing is defaulted,
 * inferred or invented — which is the condition Phase 0 decision A14 puts on
 * any public claim, and the reason the blog previously had no structured data
 * at all: its posts were fabricated, so there was nothing truthful to mark up.
 *
 * OPTIONAL FIELDS ARE OMITTED RATHER THAN FILLED IN. `author` is dropped when
 * the post has none — `blog_posts.author_id` is `ON DELETE SET NULL`, so an
 * article can genuinely outlive the account that wrote it. Naming the
 * organisation as the author in that case would be a small lie told to a
 * crawler, and an `author` of "Admin" would be a worse one.
 *
 * `publisher` IS safe to state: the organisation did publish it, and the name
 * comes from site configuration rather than from a guess.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function blogPostingSchema(post: {
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  authorName: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  /**
   * The schema.org type and the path it lives at.
   *
   * Added in Phase 10.8 so SUCCESS STORIES can use this too — `seo-strategy.md`
   * §5 asks for Article markup on "blog posts and stories", and only the blog
   * had it. Defaulted, so the blog's call site is unchanged.
   *
   * A story is an `Article` rather than a `BlogPosting`: it is a published
   * account of somebody's life, not a post in a blog, and the distinction is
   * free to make correctly.
   */
  type?: 'BlogPosting' | 'Article';
  pathPrefix?: string;
}): Record<string, unknown> | null {
  // Without a publication date it is not an article a crawler should trust,
  // and `datePublished` is required by the type. No date, no markup.
  if (!post.publishedAt) return null;

  const path = `${post.pathPrefix ?? '/blog'}/${post.slug}`;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': post.type ?? 'BlogPosting',
    headline: post.title,
    url: canonicalUrl(path),
    mainEntityOfPage: canonicalUrl(path),
    datePublished: post.publishedAt,
    publisher: { '@type': 'NGO', name: siteConfig.name, url: siteConfig.url },
  };

  if (post.description) schema.description = post.description;
  if (post.imageUrl) schema.image = post.imageUrl;
  if (post.updatedAt) schema.dateModified = post.updatedAt;
  if (post.authorName) schema.author = { '@type': 'Person', name: post.authorName };

  return schema;
}
