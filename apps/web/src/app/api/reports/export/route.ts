import { NextResponse, type NextRequest } from 'next/server';

import { API_PREFIX } from '@sailent/config';

import { getAccessToken } from '@/lib/auth/session';

const API_BASE = process.env.API_URL ?? 'http://localhost:4000';

/**
 * Download a report as CSV.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A ROUTE HANDLER, NOT A SERVER ACTION, BECAUSE THE ANSWER IS A FILE.
 *
 * A server action would have to carry several megabytes of CSV back through
 * the RSC payload for the browser to rebuild into a Blob. A route handler
 * hands the browser a response with `Content-Disposition` and the download
 * happens the way downloads happen.
 *
 * THE BROWSER STILL NEVER SEES THE STAFF TOKEN (decision A1). It lives in an
 * httpOnly cookie, is read here on the server, and the request to the API is
 * made from this process.
 *
 * `@Sensitive()` ON THE API MEANS THIS CAN COME BACK 403. A download cannot
 * render a password prompt, so it redirects to the reports page with a flag
 * and that page shows the panel — which is where the operator can actually
 * answer it.
 * ══════════════════════════════════════════════════════════════════════════
 */
export async function GET(request: NextRequest) {
  const dataset = request.nextUrl.searchParams.get('dataset') ?? '';
  const from = request.nextUrl.searchParams.get('from') ?? '';
  const to = request.nextUrl.searchParams.get('to') ?? '';

  const back = new URL('/admin/reports', request.nextUrl.origin);
  back.searchParams.set('from', from);
  back.searchParams.set('to', to);

  const token = await getAccessToken();
  if (!token) {
    return NextResponse.redirect(new URL('/admin/login', request.nextUrl.origin));
  }

  const upstream = await fetch(
    `${API_BASE.replace(/\/+$/, '')}/${API_PREFIX}/admin/reports/export`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset, from, to }),
      cache: 'no-store',
    },
  );

  if (!upstream.ok) {
    /*
      The API's refusals are carried back as a query flag rather than rendered
      here. `REAUTH_REQUIRED` needs a password prompt, and a 403 body is not a
      place an operator can type one.
    */
    const payload = (await upstream.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    };

    back.searchParams.set('exportError', payload.error?.code ?? 'EXPORT_FAILED');
    if (payload.error?.message) back.searchParams.set('exportMessage', payload.error.message);
    return NextResponse.redirect(back);
  }

  const csv = await upstream.text();
  const filename =
    upstream.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ??
    'sailent-export.csv';

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // An export is personal data. It must not sit in a shared cache, and it
      // must not come back from the browser's history on a shared machine.
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
