import Image from 'next/image';
import Link from 'next/link';

import { PageShell } from '@/components/layout/page-shell';
import { breadcrumbSchema, jsonLd } from '@/lib/seo/structured-data';

const HERO_BANNER = '/images/events-hero-elder.webp';

/**
 * The Events hero section, unified with the approved Stories hero design
 * while preserving the events banner artwork.
 */
export function EventsHero() {
  return (
    <section aria-labelledby="events-title" className="relative pt-4 sm:pt-6">
      {/* Structured data for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Events', path: '/events' },
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
              <span aria-current="page">Events</span>
            </li>
          </ol>
        </nav>
        <p>Sailent Foundation Events</p>
        <h1 id="events-title">Events</h1>
        <p>
          Join us at our upcoming events and be part of meaningful activities. Meet our team,
          support our initiatives, and create a positive impact in the community.
        </p>
      </div>

      <PageShell>
        <div className="relative overflow-hidden rounded-[24px] border border-slate-100 bg-[#12080D] shadow-[0_4px_24px_rgba(0,0,0,0.03)] sm:rounded-[32px] dark:border-slate-800">
          <Image
            src={HERO_BANNER}
            alt="Sailent Foundation Events — Community members, field activities and volunteer support"
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
