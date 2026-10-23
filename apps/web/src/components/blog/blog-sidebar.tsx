'use client';

import * as React from 'react';
import Link from 'next/link';
import { Calendar, Search, Send, Mail, ArrowRight, Check, X } from 'lucide-react';

import { cn } from '@sailent/ui';
import { emailSchema } from '@sailent/validation';

import { MediaFrame } from '@/components/media/media-frame';
import { Honeypot } from '@/components/forms/honeypot';
import { subscribeToNewsletter } from '@/lib/communications/actions';
import type { BlogPostSummary } from '@/lib/content/blog';
import { formatArticleDate } from './post-card';

export interface BlogSidebarProps {
  latestPosts: BlogPostSummary[];
  currentQuery?: string;
  className?: string;
}

/**
 * Right sidebar for the Sailent Foundation Blog.
 * Matches the reference design:
 * 1. Search field with "Search articles..." placeholder
 * 2. "Latest Articles" panel with compact thumbnails, titles, and dates
 * 3. "Subscribe to Our Blog" panel with email subscription form
 */
export function BlogSidebar({ latestPosts, currentQuery = '', className }: BlogSidebarProps) {
  return (
    <aside aria-label="Blog sidebar" className={cn('space-y-6', className)}>
      {/* 1. Search Field */}
      <section aria-label="Search blog">
        <form action="/blog" method="GET" className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-4 size-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            name="q"
            defaultValue={currentQuery}
            placeholder="Search articles..."
            aria-label="Search articles"
            className="shadow-2xs h-11 w-full rounded-full border border-slate-200/90 bg-white pl-11 pr-10 text-sm text-[#102A43] transition-all placeholder:text-slate-400 focus:border-[#EB6A1F] focus:outline-none focus:ring-2 focus:ring-[#EB6A1F]/25"
          />
          {currentQuery ? (
            <Link
              href="/blog"
              aria-label="Clear search"
              className="absolute right-3.5 flex size-5 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
            >
              <X className="size-3" aria-hidden="true" />
            </Link>
          ) : null}
        </form>
      </section>

      {/* 2. Latest Articles Panel */}
      <section
        aria-labelledby="latest-articles-title"
        className="card-interactive rounded-2xl p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-4 flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-4 w-1 rounded-full bg-[#EB6A1F]" />
          <h3
            id="latest-articles-title"
            className="font-display text-base font-bold text-[#102A43]"
          >
            Latest Articles
          </h3>
        </div>

        {latestPosts.length === 0 ? (
          <p className="text-xs italic text-slate-500">No articles published yet.</p>
        ) : (
          <ul className="space-y-4">
            {latestPosts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="focus-visible:outline-ring group flex items-start gap-3.5 rounded-lg"
                >
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-100">
                    <MediaFrame
                      media={{
                        seed: `blog-${post.slug}`,
                        alt: post.featuredImageAlt ?? post.title,
                        ...(post.featuredImageUrl ? { url: post.featuredImageUrl } : {}),
                      }}
                      aspect="square"
                      rounded={false}
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-display group-hover:text-primary line-clamp-2 text-xs font-semibold leading-snug text-[#102A43] transition-colors sm:text-sm">
                      {post.title}
                    </h4>
                    {post.publishedAt ? (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                        <Calendar className="size-3 shrink-0 text-[#EB6A1F]" aria-hidden="true" />
                        <time dateTime={post.publishedAt}>
                          {formatArticleDate(post.publishedAt)}
                        </time>
                      </div>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3. Subscribe to Our Blog Panel */}
      <BlogNewsletterCard />
    </aside>
  );
}

/**
 * Newsletter card for the Blog sidebar.
 * Connected to the real `subscribeToNewsletter` server action.
 */
function BlogNewsletterCard() {
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Enter a valid email address');
      return;
    }
    setError(null);
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const response = await subscribeToNewsletter(data);
      if (response.ok) {
        setSubmitted(true);
      } else {
        setError(
          response.fieldErrors?.email ?? response.error ?? 'Subscription could not be completed.',
        );
      }
    });
  };

  return (
    <section
      aria-labelledby="subscribe-panel-title"
      className="card-interactive relative overflow-hidden rounded-2xl p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Decorative warm peach gradient corner */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-gradient-to-br from-orange-200/50 to-amber-100/30 blur-lg"
      />

      <div className="relative">
        <div className="flex items-center gap-2">
          <Send className="size-4 stroke-[2.2] text-[#EB6A1F]" aria-hidden="true" />
          <h3
            id="subscribe-panel-title"
            className="font-display text-base font-bold text-[#102A43]"
          >
            Subscribe to Our Blog
          </h3>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          Get the latest articles, updates and inspiring stories delivered to your inbox.
        </p>

        {submitted ? (
          <div
            role="status"
            className="mt-4 flex items-start gap-2.5 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800"
          >
            <Check
              className="mt-0.5 size-4 shrink-0 stroke-[2.5] text-emerald-600"
              aria-hidden="true"
            />
            <span>Nearly done — check your inbox and confirm with the link we sent.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-4">
            <Honeypot />
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) {
                    setError(emailSchema.safeParse(e.target.value).success ? null : error);
                  }
                }}
                required
                autoComplete="email"
                placeholder="Enter your email address"
                aria-label="Email address"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-3 text-xs text-[#102A43] transition-all placeholder:text-slate-400 focus:border-[#EB6A1F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EB6A1F]/25"
              />
            </div>

            {error ? (
              <p role="alert" className="text-destructive mt-1.5 text-xs font-medium">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="shadow-xs focus-visible:outline-ring text-primary-foreground hover:bg-primary-hover mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#EB6A1F] text-xs font-semibold transition-colors active:bg-[#B3450E] disabled:opacity-50 sm:text-sm"
            >
              <span>{pending ? 'Subscribing…' : 'Subscribe'}</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
