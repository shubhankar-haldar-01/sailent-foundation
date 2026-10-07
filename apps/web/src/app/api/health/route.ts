import { NextResponse } from 'next/server';

/*
  Evaluated on every request, never prerendered: a cached health answer would
  report the uptime of the build (Phase 14).
*/
export const dynamic = 'force-dynamic';

/**
 * Liveness for the web app itself, and Cloud Run's probe for the web service
 * (Phase 14). It touches nothing: the web server's job is to answer, and a
 * slow or failing API must not get web instances restarted — the API has
 * its own readiness probe. No configuration value appears in the answer.
 */
export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'sailent-web',
      environment: process.env.APP_ENV ?? 'development',
      uptimeSeconds: Math.floor(process.uptime()),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
