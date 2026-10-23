import Image from 'next/image';
import Link from 'next/link';

import { PageShell } from '@/components/layout/page-shell';
import { breadcrumbSchema, jsonLd } from '@/lib/seo/structured-data';

const HERO_IMAGE = '/images/programs-hero-banner.webp';

/**
 * The Programs hero section, unified with the full-card hero design.
 */
export function ProgramsHero() {
  return (
    <section aria-labelledby="programs-title" className="relative pt-4 sm:pt-6">
      {/* Structured data for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Programs', path: '/programs' },
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
              <span aria-current="page">Programs</span>
            </li>
          </ol>
        </nav>
        <p>Sailent Foundation Programs</p>
        <h1 id="programs-title">Programs — Long-Term Work, Lasting Impact</h1>
        <p>
          Our programs run for years and are measured over time. Campaigns fund specific pieces of
          them, which is why a campaign always belongs to a program.
        </p>
      </div>

      <PageShell>
        <div className="relative overflow-hidden rounded-[24px] border border-slate-100 bg-[#0F172A] shadow-[0_4px_24px_rgba(0,0,0,0.03)] sm:rounded-[32px] dark:border-slate-800">
          <Image
            src={HERO_IMAGE}
            alt="Sailent Foundation community development programs in action across healthcare, education, and livelihoods"
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
