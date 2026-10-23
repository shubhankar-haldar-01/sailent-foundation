import Image from 'next/image';
import Link from 'next/link';

import { PageShell } from '@/components/layout/page-shell';
import { breadcrumbSchema, jsonLd } from '@/lib/seo/structured-data';

const HERO_IMAGE = '/images/stories-hero-banner.webp';

/**
 * The Stories hero section, unified with the full-card hero design.
 */
export function StoriesHero() {
  return (
    <section aria-labelledby="stories-title" className="relative pt-4 sm:pt-6">
      {/* Structured data for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Stories', path: '/stories' },
          ]),
        )}
      />

      {/* Semantic Screen-Reader Content */}
      <div className="sr-only">
        <nav aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <span aria-current="page">Stories</span>
            </li>
          </ol>
        </nav>
        <p>Sailent Foundation Stories</p>
        <h1 id="stories-title">Stories — Real Voices, Real Change</h1>
        <p>
          Stories from children, families, and communities whose lives are changing through our
          sustained work and community programs.
        </p>
      </div>

      <PageShell>
        <div className="relative overflow-hidden rounded-[24px] border border-slate-100 bg-[#0F172A] shadow-[0_4px_24px_rgba(0,0,0,0.03)] sm:rounded-[32px] dark:border-slate-800">
          <Image
            src={HERO_IMAGE}
            alt="Smiling Indian schoolgirls in blue uniforms sitting together in their classroom with colourful schoolbags and notebooks"
            width={1671}
            height={752}
            priority
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="h-auto w-full object-cover"
          />
        </div>
      </PageShell>
    </section>
  );
}
