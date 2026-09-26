import { NextResponse } from 'next/server';

/** Liveness for the web app itself. The API has its own probe. */
export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'sailent-web',
    environment: process.env.APP_ENV ?? 'development',
    uptimeSeconds: Math.floor(process.uptime()),
  });
}
