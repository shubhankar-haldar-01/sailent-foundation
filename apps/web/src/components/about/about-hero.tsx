import Image from 'next/image';
import Link from 'next/link';

import { PageShell } from '@/components/layout/page-shell';
import { breadcrumbSchema, jsonLd } from '@/lib/seo/structured-data';

const HERO_IMAGE = '/images/about-hero-banner.webp';

export function AboutHero() {
  return (
    <section aria-labelledby="about-title" className="relative pt-4 sm:pt-6">
      {/* Structured data for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'About us', path: '/about' },
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
              <span aria-current="page">About us</span>
            </li>
          </ol>
        </nav>
        <p>About Sailent Foundation</p>
        <h1 id="about-title">About us — Real people. Lasting change.</h1>
        <p>
          We work with communities to remove real and practical obstacles in education, health,
          livelihoods, and social welfare. We focus on what is possible, work with existing systems,
          and stay accountable for what we create.
        </p>
      </div>

      <PageShell>
        <div className="border-border bg-surface-inverse shadow-card relative overflow-hidden rounded-[24px] border sm:rounded-[32px]">
          <Image
            src={HERO_IMAGE}
            alt="Sailent Foundation field team coordinator and volunteers smiling warmly with rural villagers and school children under a banyan tree"
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
