import Image from 'next/image';
import Link from 'next/link';

import { breadcrumbSchema, jsonLd } from '@/lib/seo/structured-data';

const HERO_IMAGE = '/images/team-hero-banner-v2.webp';

/**
 * The Team hero section, unified with the full-card hero design.
 */
export function TeamHero() {
  return (
    <section aria-labelledby="team-hero-title" className="relative pt-4 sm:pt-6">
      {/* Structured data for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'About Us', path: '/about' },
            { name: 'Our Team', path: '/team' },
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
              <Link href="/about">About Us</Link>
            </li>
            <li>
              <span aria-current="page">Our Team</span>
            </li>
          </ol>
        </nav>
        <p>Sailent Foundation Team</p>
        <h1 id="team-hero-title">Meet Our Team — Sailent Foundation</h1>
        <p>
          A dedicated group of people working together to support communities, create opportunities,
          and build a better tomorrow.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-[24px] border border-slate-100 bg-[#0F172A] shadow-[0_4px_24px_rgba(0,0,0,0.03)] sm:rounded-[32px] dark:border-slate-800">
        <Image
          src={HERO_IMAGE}
          alt="Sailent Foundation coordinator with children in outdoor community setting"
          width={1671}
          height={752}
          priority
          sizes="(max-width: 1280px) 100vw, 1280px"
          className="h-auto w-full object-cover"
        />
      </div>
    </section>
  );
}
