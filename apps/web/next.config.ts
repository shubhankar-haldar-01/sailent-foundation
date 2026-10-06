import type { NextConfig } from 'next';

import {
  STRICT_TRANSPORT_SECURITY,
  contentSecurityPolicy,
} from './src/lib/security/content-security-policy';
import { PERMISSIONS_POLICY } from './src/lib/security/permissions-policy';

/*
  Read when the server builds and starts. A production deployment sets
  APP_ENV=production, which turns on HSTS and upgrade-insecure-requests; local
  and E2E builds run over plain http and must not (Phase 12).
*/
const isProductionDeployment = process.env.APP_ENV === 'production';
const isDevelopmentServer = process.env.NODE_ENV === 'development';

/** `https://media.example.org/base` → a next/image remote pattern for everything under it. */
function mediaRemotePatterns(base: string | undefined) {
  if (!base) return [];
  try {
    const url = new URL(base);
    return [
      {
        protocol: url.protocol.replace(':', '') as 'http' | 'https',
        hostname: url.hostname,
        ...(url.port ? { port: url.port } : {}),
        pathname: `${url.pathname.replace(/\/$/, '')}/**`,
      },
    ];
  } catch {
    return [];
  }
}

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
    /*
      The media library's public bucket (Phase 13). `MEDIA_PUBLIC_BASE_URL` is
      the same value as the API's `R2_PUBLIC_BASE_URL`; unset, no remote image
      is allowed (as before), and library covers and gallery images cannot be
      rendered by next/image. Read at BUILD time.
    */
    remotePatterns: mediaRemotePatterns(process.env.MEDIA_PUBLIC_BASE_URL),
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          // Payment is allowed for Razorpay Checkout's frame only — see the module.
          { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
          // Phase 12: see the module for each directive.
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy({
              development: isDevelopmentServer,
              production: isProductionDeployment,
            }),
          },
          ...(isProductionDeployment
            ? [{ key: 'Strict-Transport-Security', value: STRICT_TRANSPORT_SECURITY }]
            : []),
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
