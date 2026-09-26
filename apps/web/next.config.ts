import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,

  // The design system is consumed as TypeScript source rather than a build
  // artefact, so a token change is visible without a rebuild step.
  transpilePackages: ['@sailent/ui', '@sailent/types', '@sailent/validation', '@sailent/config'],

  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  images: {
    // AVIF first, WebP fallback: bandwidth matters on the connections our
    // donors actually use.
    formats: ['image/avif', 'image/webp'],
    // R2 public bucket is added here once the domain is provisioned (Phase 4).
    remotePatterns: [],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=(), payment=()',
          },
        ],
      },
    ];
  },

  async redirects() {
    return [
      // Phase 0 merged /reports into /transparency to avoid two pages of PDFs
      // for the same audience. Phase 2 keeps ONE document library but moves it
      // to the shorter, more linkable /reports — which serves that reasoning
      // better. The old nested URL redirects so external links survive.
      { source: '/transparency/reports', destination: '/reports', permanent: true },
    ];
  },
};

export default config;
