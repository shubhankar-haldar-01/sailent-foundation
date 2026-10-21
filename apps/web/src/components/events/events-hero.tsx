import Link from 'next/link';
import Image from 'next/image';

import { breadcrumbSchema, jsonLd } from '@/lib/seo/structured-data';

const HERO_BANNER = '/images/events-hero-elder.webp';

/**
 * The events page's banner: one full-width panoramic image (1671×752) with the
 * "EVENTS" title, its orange rules and the purple heart set in the artwork.
 *
 * - The artwork is an illustrative composite of the kinds of activity the
 *   events cover (school kits, food distribution, animal care) — not a record
 *   of a particular event — so nothing on the page presents it as one.
 * - The breadcrumb, the h1 "Events" and the lead are screen-reader text beside
 *   it, with the breadcrumb's structured data.
 */
export function EventsHero() {
  return (
    <section
      aria-labelledby="events-title"
      className="border-border relative isolate w-full overflow-hidden border-b bg-[#12080D]"
    >
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

      {/* Full-Width Panoramic Banner */}
      <div className="relative block w-full overflow-hidden">
        <Image
          src={HERO_BANNER}
          alt="Events — Sailent Foundation"
          width={1671}
          height={752}
          priority
          sizes="100vw"
          className="h-auto w-full object-cover"
        />
      </div>
    </section>
  );
}
