import path from 'node:path';

import type { NextConfig } from 'next';

import {
  STRICT_TRANSPORT_SECURITY,
  contentSecurityPolicy,
} from './src/lib/security/content-security-policy';
import { mediaRemotePatterns } from './src/lib/security/media-remote-patterns';
import { PERMISSIONS_POLICY } from './src/lib/security/permissions-policy';

/*
  Read when the server builds and starts. A production deployment sets
  APP_ENV=production, which turns on HSTS and upgrade-insecure-requests; local
  and E2E builds run over plain http and must not (Phase 12).
*/
const isProductionDeployment = process.env.APP_ENV === 'production';
const isDevelopmentServer = process.env.NODE_ENV === 'development';

/*
  The container build (apps/web/Dockerfile, Phase 14) sets NEXT_OUTPUT=standalone:
  a self-contained server (`server.js`) with only the files it needs, traced
  from the monorepo root. Local `next start` and the E2E suite are unchanged.
*/
const standalone = process.env.NEXT_OUTPUT === 'standalone';

const config: NextConfig = {
  reactStrictMode: true,
  ...(standalone
    ? { output: 'standalone' as const, outputFileTracingRoot: path.join(__dirname, '../..') }
    : {}),

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
      rendered by next/image. Read at BUILD time; validated (Phase 14) — one
      exact host, no credentials, https in production — or the build fails.
    */
    remotePatterns: mediaRemotePatterns(process.env.MEDIA_PUBLIC_BASE_URL, {
      production: isProductionDeployment,
    }),
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
