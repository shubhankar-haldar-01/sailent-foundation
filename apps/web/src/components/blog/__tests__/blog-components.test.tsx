import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { BlogPostSummary } from '@/lib/content/blog';
import { PostCard, formatArticleDate } from '../post-card';
import { BlogHero } from '../blog-hero';
import { BlogSidebar } from '../blog-sidebar';

const samplePost: BlogPostSummary = {
  title: 'Help Save 300+ Injured And Abandoned Cows In Haryana This Mahashivratri 2026',
  slug: 'help-save-300-injured-and-abandoned-cows-in-haryana-this-mahashivratri-2026',
  excerpt:
    'Every year on Mahashivratri, thousands of devotees offer milk in devotion. This year, we are working to save and support 300+ injured and abandoned cows.',
  categoryName: null,
  categorySlug: null,
  authorName: 'Development Admin',
  featuredImageUrl: '/images/campaign-animal-care-pune.webp',
  featuredImageAlt: 'Injured and abandoned cows receiving care',
  publishedAt: '2026-02-15T04:30:00.000Z',
  updatedAt: '2026-02-15T04:30:00.000Z',
};

const secondPost: BlogPostSummary = {
  title: 'Why Caring For Vulnerable Communities Defines A Truly Strong Republic',
  slug: 'why-caring-for-vulnerable-communities-defines-a-truly-strong-republic',
  excerpt:
    'Every Republic Day, we are reminded of our shared responsibility to build a kinder, more inclusive society.',
  categoryName: null,
  categorySlug: null,
  authorName: 'Development Admin',
  featuredImageUrl: '/images/community-volunteers.webp',
  featuredImageAlt: 'Volunteers working with community',
  publishedAt: '2026-01-26T03:30:00.000Z',
  updatedAt: '2026-01-26T03:30:00.000Z',
};

describe('formatArticleDate', () => {
  it('formats dates in "15 Feb 2026" notation matching reference design', () => {
    expect(formatArticleDate('2026-02-15T04:30:00.000Z')).toBe('15 Feb 2026');
    expect(formatArticleDate('2026-01-26T03:30:00.000Z')).toBe('26 Jan 2026');
    expect(formatArticleDate(null)).toBe('');
    expect(formatArticleDate(undefined)).toBe('');
  });
});

describe('BlogHero', () => {
  it('renders breadcrumb, orange label, headline and supporting text', () => {
    render(<BlogHero />);

    expect(screen.getByRole('link', { name: 'Home' })).toBeDefined();
    expect(screen.getByText('Blog')).toBeDefined();
    expect(screen.getByText(/Our Blog/i)).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 1, name: /Ideas, insights and stories that matter/i }),
    ).toBeDefined();
    expect(
      screen.getByText(/Explore our latest articles, updates and perspectives/i),
    ).toBeDefined();
  });
});

describe('PostCard', () => {
  it('renders title with link, date, excerpt and read more link', () => {
    render(<PostCard post={samplePost} />);

    const link = screen.getByRole('link', { name: samplePost.title });
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe(`/blog/${samplePost.slug}`);
    expect(screen.getByText('15 Feb 2026')).toBeDefined();
    expect(screen.getByText(samplePost.excerpt!)).toBeDefined();
    expect(screen.getByText(/Read More/i)).toBeDefined();
  });

  it('renders warm cream background for featured post and white for standard post', () => {
    const { container: featuredContainer } = render(<PostCard post={samplePost} featured={true} />);
    expect(featuredContainer.querySelector('article')?.className).toContain('bg-[#FFF9F4]');

    const { container: standardContainer } = render(
      <PostCard post={samplePost} featured={false} />,
    );
    expect(standardContainer.querySelector('article')?.className).toContain('bg-white');
  });

  it('omits reading time gracefully when not available in post metadata', () => {
    render(<PostCard post={samplePost} />);
    expect(screen.queryByText(/min read/i)).toBeNull();
  });

  it('renders reading time when provided in post metadata', () => {
    render(<PostCard post={{ ...samplePost, readingTime: '5 min read' }} />);
    expect(screen.getByText('5 min read')).toBeDefined();
  });

  it('supports vertical layout for multi-column grids', () => {
    const { container } = render(<PostCard post={samplePost} layout="vertical" />);
    expect(container.querySelector('article')?.className).toContain('flex-col');
  });
});

describe('BlogSidebar', () => {
  it('renders search input with "Search articles..." placeholder', () => {
    render(<BlogSidebar latestPosts={[samplePost, secondPost]} currentQuery="" />);

    expect(screen.getByPlaceholderText('Search articles...')).toBeDefined();
  });

  it('renders Latest Articles section with posts and formatted dates', () => {
    render(<BlogSidebar latestPosts={[samplePost, secondPost]} currentQuery="" />);

    expect(screen.getByRole('heading', { level: 3, name: 'Latest Articles' })).toBeDefined();
    expect(screen.getByText(samplePost.title)).toBeDefined();
    expect(screen.getByText(secondPost.title)).toBeDefined();
    expect(screen.getByText('15 Feb 2026')).toBeDefined();
    expect(screen.getByText('26 Jan 2026')).toBeDefined();
  });

  it('renders Subscribe to Our Blog section with email input and submit button', () => {
    render(<BlogSidebar latestPosts={[samplePost]} currentQuery="" />);

    expect(screen.getByRole('heading', { level: 3, name: 'Subscribe to Our Blog' })).toBeDefined();
    expect(screen.getByPlaceholderText('Enter your email address')).toBeDefined();
    expect(screen.getByRole('button', { name: /Subscribe/i })).toBeDefined();
  });
});
