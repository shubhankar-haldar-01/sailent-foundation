import { describe, expect, it } from 'vitest';

import { buildMetadata, canonicalUrl } from '../seo/metadata';
import {
  breadcrumbSchema,
  organizationSchema,
  blogPostingSchema,
  jsonLd,
} from '../seo/structured-data';

describe('canonicalUrl', () => {
  it('produces absolute URLs without a trailing slash', () => {
    expect(canonicalUrl('/')).not.toMatch(/\/$/);
    expect(canonicalUrl('/campaigns')).toMatch(/\/campaigns$/);
  });

  it('normalises leading and trailing slashes to one canonical form', () => {
    expect(canonicalUrl('campaigns')).toBe(canonicalUrl('/campaigns/'));
  });
});

describe('buildMetadata', () => {
  it('puts the distinguishing words before the organization name', () => {
    const meta = buildMetadata({ title: 'Campaigns', path: '/campaigns' });
    // `absolute`, so the root layout's `%s — Sailent Foundation` template does
    // not append the name a second time.
    expect(meta.title).toEqual({ absolute: 'Campaigns — Sailent Foundation' });
  });

  it('never appends the organization name twice', () => {
    const meta = buildMetadata({ title: 'Campaigns', path: '/campaigns' });
    const rendered = (meta.title as { absolute: string }).absolute;
    expect(rendered.match(/Sailent Foundation/g)).toHaveLength(1);
  });

  it('lets a page replace the generated title outright', () => {
    // The homepage names the organization first — it is the page reached by
    // searching for it.
    const meta = buildMetadata({
      title: 'Empowering People',
      titleOverride: 'Sailent Foundation | Empowering People',
      path: '/',
    });
    expect(meta.title).toEqual({ absolute: 'Sailent Foundation | Empowering People' });
  });

  it('marks private routes noindex', () => {
    const meta = buildMetadata({ title: 'Your account', path: '/account', noIndex: true });
    expect(meta.robots).toMatchObject({ index: false, follow: false });
  });

  it('indexes public routes by default', () => {
    const meta = buildMetadata({ title: 'About', path: '/about' });
    expect(meta.robots).toMatchObject({ index: true });
  });
});

describe('organizationSchema', () => {
  it('omits registration details entirely when none are supplied', () => {
    // Asserting an unverified registration is the misleading markup we avoid.
    const schema = organizationSchema();
    expect(schema).not.toHaveProperty('address');
    expect(schema).not.toHaveProperty('contactPoint');
    expect(schema['@type']).toBe('NGO');
  });

  it('includes contact details only when given', () => {
    const schema = organizationSchema({ email: 'hello@example.org' });
    expect(schema.contactPoint).toMatchObject({ email: 'hello@example.org' });
  });
});

describe('breadcrumbSchema', () => {
  it('numbers positions from 1 so the trail matches what is rendered', () => {
    const schema = breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Campaigns', path: '/campaigns' },
    ]);
    const items = schema.itemListElement as { position: number; name: string }[];
    expect(items.map((item) => item.position)).toEqual([1, 2]);
    expect(items[1]?.name).toBe('Campaigns');
  });
});

describe('article structured data — blog posts and stories (Phase 10.8)', () => {
  const base = {
    title: 'What a school kit costs',
    slug: 'what-a-school-kit-costs',
    description: 'Line by line.',
    imageUrl: 'https://cdn.example.org/a.jpg',
    publishedAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  };

  it('marks a blog post as BlogPosting under /blog, as before', () => {
    const schema = blogPostingSchema({ ...base, authorName: 'Asha Verma' })!;

    expect(schema['@type']).toBe('BlogPosting');
    expect(schema.url).toMatch(/\/blog\/what-a-school-kit-costs$/);
    expect(schema.author).toEqual({ '@type': 'Person', name: 'Asha Verma' });
  });

  it('marks a story as Article under /stories', () => {
    /*
      §5 asks for Article markup on "blog posts and stories". Only the blog had
      it until Phase 10.8. A story is an `Article`, not a `BlogPosting` — a
      published account of somebody's life rather than a post in a blog.
    */
    const schema = blogPostingSchema({
      ...base,
      type: 'Article',
      pathPrefix: '/stories',
      slug: 'sunita-finished-school',
      authorName: null,
      updatedAt: null,
    })!;

    expect(schema['@type']).toBe('Article');
    expect(schema.url).toMatch(/\/stories\/sunita-finished-school$/);
    expect(schema.mainEntityOfPage).toBe(schema.url);
  });

  it('OMITS author entirely when there is none, rather than inventing one', () => {
    // A story has no author column. Naming the organisation, or "Admin", would
    // be a small lie told to a crawler — decision A14.
    const schema = blogPostingSchema({ ...base, type: 'Article', authorName: null })!;

    expect('author' in schema).toBe(false);
    expect(JSON.stringify(schema)).not.toContain('Admin');
  });

  it('omits dateModified when nothing recorded one', () => {
    const schema = blogPostingSchema({ ...base, authorName: null, updatedAt: null })!;
    expect('dateModified' in schema).toBe(false);
    expect(schema.datePublished).toBe(base.publishedAt);
  });

  it('emits NO markup at all without a publication date', () => {
    // `datePublished` is required by the type; a guess would be a fabrication.
    expect(blogPostingSchema({ ...base, authorName: null, publishedAt: null })).toBeNull();
  });

  it('always names the organisation as publisher', () => {
    const schema = blogPostingSchema({ ...base, type: 'Article', authorName: null })!;
    expect(schema.publisher).toMatchObject({ '@type': 'NGO' });
  });
});

describe('jsonLd', () => {
  it('cannot close its own script element', () => {
    const { __html } = jsonLd({ name: 'Relief </script><script>alert(1)</script> & more' });
    expect(__html).not.toMatch(/[<>&]/);
    expect(__html).not.toContain('</script');
  });

  it('is still the same data to a JSON parser', () => {
    const schema = { name: 'A < B > C & D', text: 'line\u2028sep\u2029end' };
    const { __html } = jsonLd(schema);
    expect(__html).not.toMatch(/[\u2028\u2029]/);
    expect(JSON.parse(__html)).toEqual(schema);
  });
});
