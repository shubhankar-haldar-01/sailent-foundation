import Link from 'next/link';
import Image from 'next/image';

import { breadcrumbSchema, jsonLd } from '@/lib/seo/structured-data';

/**
 * Editorial Hero for the Sailent Foundation Blog.
 * 100% exact match to the owner-approved banner artwork:
 * - Full-width high-resolution artwork (2103x748)
 * - Watercolor background wash blending seamlessly with the page surface
 * - Complete torn-paper collage with smiling student, village backdrop, orange radiant marks, and olive botanical sprig
 * - Semantic and accessible hierarchy with Breadcrumb, H1 headline, and lead text
 * - No visible breadcrumb: "Home > Blog" was erased from the artwork at the owner's
 *   request (2026-10-15); the screen-reader breadcrumb and its structured data remain
 */
export function BlogHero() {
  return (
    <section
      aria-label="Blog introduction"
      className="relative w-full overflow-hidden bg-[#F2F8FD]"
    >
      {/* Structured data for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Blog', path: '/blog' },
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
              <span aria-current="page">Blog</span>
            </li>
          </ol>
        </nav>
        <p>Our Blog</p>
        <h1>Ideas, insights and stories that matter</h1>
        <p>
          Explore our latest articles, updates and perspectives on education, healthcare, community
          development and the people we work with.
        </p>
      </div>

      {/* Visual Presentation: 100% Exact Matching Banner Artwork */}
      <div className="relative mx-auto w-full max-w-[2103px]">
        <div className="relative aspect-[2103/748] w-full">
          <Image
            src="/images/blog-hero-banner-v2.webp"
            alt="Ideas, insights and stories that matter — Sailent Foundation Blog"
            fill
            priority
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, (max-width: 1440px) 1440px, 2103px"
            className="object-contain object-center"
          />
        </div>
      </div>
    </section>
  );
}
