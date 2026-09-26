import { Button, Input } from '@sailent/ui';

import { EXPORT_DATASETS, type ExportDataset } from '@sailent/validation';

/**
 * The date range, and the export button.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A PLAIN GET FORM. NO CLIENT COMPONENT, NO ROUTER.
 *
 * A report somebody is reading is a thing they will want to send to a
 * colleague — "look at March" — so the range has to live in the URL rather
 * than in React state, or the link shows the recipient something else. It is
 * also what lets the server component render the figures at all.
 *
 * The first version pushed the new query with `useRouter`, which is a client
 * component, a transition, and a dependency on JavaScript having loaded — for
 * something a `<form method="get">` has done since 1995. Submitting one puts
 * exactly these two fields in the query string of the current path, which is
 * the whole requirement.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function RangePicker({ from, to }: { from: string; to: string }) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <label className="text-body-sm">
        <span className="text-muted-foreground block">From</span>
        <Input type="date" name="from" defaultValue={from} className="mt-1" />
      </label>
      <label className="text-body-sm">
        <span className="text-muted-foreground block">To</span>
        <Input type="date" name="to" defaultValue={to} className="mt-1" />
      </label>
      <Button type="submit" variant="secondary">
        Apply
      </Button>
    </form>
  );
}

/**
 * Export links.
 *
 * ORDINARY LINKS, not form submissions: the route handler answers with a file,
 * and a link is what makes a browser download one. The handler reads the staff
 * token server-side, so nothing here holds a credential.
 */
export function ExportLinks({
  from,
  to,
  allowed,
}: {
  from: string;
  to: string;
  /** Datasets this operator holds the extra permission for. */
  allowed: ExportDataset[];
}) {
  if (allowed.length === 0) return null;

  return (
    /*
      A labelled REGION, not a bare div. The dataset links share their names
      with the sidebar's — "Donations" is both a menu item and an export — so
      the landmark is what lets anybody, a screen-reader user included,
      distinguish "the export called Donations" from "the Donations screen".
    */
    <section aria-labelledby="export-heading" className="border-border rounded-lg border p-5">
      <h2 id="export-heading" className="text-h4 font-semibold">
        Export
      </h2>
      <p className="text-body-sm text-muted-foreground mt-1">
        CSV, for the range above. Each export asks for your password again and is recorded in the
        audit log with the number of rows.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {allowed.map((dataset) => (
          <li key={dataset}>
            <Button asChild variant="ghost" size="sm">
              <a
                href={`/api/reports/export?dataset=${dataset}&from=${from}&to=${to}`}
                /*
                  NO `download` ATTRIBUTE, deliberately.

                  With it the browser treats the response as a file whatever it
                  is — including the redirect the handler issues when the API
                  answers REAUTH_REQUIRED. The operator clicked Export and
                  nothing happened at all, which is the worst possible answer
                  to "you need to confirm your password".

                  Without it the browser NAVIGATES: a successful response still
                  downloads, because `Content-Disposition: attachment` says so
                  and the page stays where it is; a redirect lands on the
                  reports page, which shows the prompt.
                */
              >
                {EXPORT_DATASETS[dataset].label}
              </a>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A figure, with its label. Money arrives as paise and is formatted once. */
export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="border-border rounded-lg border p-4">
      <p className="text-caption text-muted-foreground uppercase">{label}</p>
      <p className="font-display text-h2 mt-1 font-bold tabular-nums">{value}</p>
      {hint ? <p className="text-caption text-muted-foreground mt-1">{hint}</p> : null}
    </div>
  );
}
