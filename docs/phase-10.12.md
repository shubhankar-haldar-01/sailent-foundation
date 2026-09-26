# Phase 10.12 — Reports & analytics

**Production was not touched.** No migration, seed, push, studio or admin
command ran against it. **This phase adds no migration at all** — see §C.

---

## A. Scope, and where it comes from

The next documented module after NOTIFICATIONS (§4.21, Phase 10.11):

> **§4.22 REPORTS & ANALYTICS** — "Donations, campaigns, volunteers and impact.
> Date ranges, CSV export, and the reconciliation and 10BD readiness views."
>
> **Done when:** "Finance can export donations for an arbitrary range with
> payment state, and every export is audited."

Corroborated by `api-architecture.md` (the `/admin/reports/*` and export route
map), `database-architecture.md` §11.1 (the indexes these queries were designed
around) and `phase-0-decisions.md` A2, A3, A7 and A14.

"Finance" is a role name from the Phase 0 six-role design. There is one
administrative role — `SUPER_ADMIN` — so the permissions are what carry the
distinction, and they already existed.

## B. What was already there

| Already built | Missing |
| --- | --- |
| `reports.read`, `reports.export`, `donation.export`, `donor.export`, `volunteer.export`, `audit.export` — all seeded | Any route using them |
| `donations.tax_id_captured`, "denormalised for the 10BD readiness view" | The view |
| `donors_missing_tax_id_idx`, a partial index on `tax_id_number IS NULL` | Anything querying it |
| `donations_pending_idx`, partial on `status IN ('pending','processing')` | The reconciliation sweep it was made for |
| Two sidebar entries marked `phase: 'Phase 5'` | The screens behind them |

Every index these reports need was created in migration `0000` for exactly this
purpose.

## C. Database — no migration

Checked before assuming: `donations_pending_idx`, `donations_status_created_idx`
and `donors_missing_tax_id_idx` all exist with the predicates
`database-architecture.md` §11.1 specifies. `tax_id_captured` is on `donations`
and `tax_id_number` on `donors`.

**Nothing was missing, so nothing was added.** A migration that created an index
Postgres already had would be a migration written to make a phase look
substantial.

Permissions are also unchanged at **112** — the six this phase needs were seeded
long before it.

## D. The four views, plus two

`GET /admin/reports/{donations,campaigns,volunteers,impact,reconciliation,tax-readiness}`,
every one taking `from` and `to`.

**Donations are broken down by payment state**, which is §4.22's own wording and
the thing that makes the report useful: a view showing only successful
donations cannot answer "why is the bank total lower than the site's", which is
the question Finance actually has.

**Campaigns join the range in the JOIN condition, not the WHERE.** Putting the
dates in the WHERE turns the left join into an inner one and silently drops
every campaign that raised nothing in the period — which are exactly the
campaigns somebody running the report needs to see.

**Reconciliation answers one question: what is stuck?** A donation sits
`pending` between the donor pressing pay and a signature-verified webhook
(decision A3). Most resolve in seconds; the ones that do not are either an
abandoned checkout or money that arrived and was never recorded, and from here
those look identical — which is why a human has to look rather than the platform
guessing. It also counts captured donations with no receipt, a figure that
should be structurally impossible and is checked anyway.

**Nothing on that screen can change a payment**, and the E2E suite asserts the
absence. A button that marked a donation successful would be a button that takes
an unverified word for it.

**10BD readiness counts what would be missing and files nothing.** A7: the
receipt a donor already holds is not their 80G certificate. A captured donation
with no donor tax ID cannot go on the return, so the donor gets no relief — and
the time to find that out is while the year is open, not on 31 May.

## E. Export

`POST /admin/reports/export`, `@Sensitive()`, five datasets.

**The export route is not a way round the other permissions.** This module reads
across every other one, so `reports.export` alone producing a donor CSV would be
a way to read personal data without `donor.export`. Each dataset declares the
permission it *additionally* requires, and the service checks both. The dataset
list is closed — a free-text one would name any table at all.

**CSV is generated with formula injection in mind.** Excel, LibreOffice and
Sheets all execute a cell beginning `=`, `+`, `-`, `@`, a tab or a carriage
return. Nearly every column here is free text somebody outside the organisation
typed: a donor name, a dedication, a campaign title. Every value is quoted, and
any value leading with one of those characters is prefixed so the spreadsheet
reads it as text. The realistic case is not an attacker — it is a campaign
called "-40% malnutrition in Bastar".

A BOM is written so Excel reads UTF-8 rather than guessing a codepage, and the
filename is sanitised because it goes in a `Content-Disposition` header.

**Two things are deliberately not in a CSV:**

- **A raw tax ID.** It is SENSITIVE and encrypted at rest; an export is a file
  that gets emailed around, and a PAN in one is a disclosure that cannot be
  recalled. The donor export carries `tax_id_on_file` instead.
- **Nothing is hidden from Finance, though.** `anonymous` is a *column*, not a
  reason to withhold a name: the schema says "Public display only. Finance can
  always identify the donor", and a 10BD return needs the real person. The
  column tells whoever opens the file not to publish it — which a blank cell
  would not.

**Bounded at 50,000 rows and 731 days**, and an over-large export is **refused
rather than truncated**. A CSV silently missing its last hundred thousand rows
looks complete, reconciles against nothing, and gives the reader no way to tell.

**Every export writes an audit row with the row count** — §4.22's own
requirement — at `warning` severity when the dataset carries personal data.

## F. Admin UI

`/admin/reports`, and the two placeholders activated: `/admin/reconciliation`
and `/admin/tax`.

The range lives in the URL via a **plain `<form method="get">`**. A report
somebody is reading is a thing they will want to send to a colleague, and a
range held in React state produces a link that shows the recipient something
else. The first version used `useRouter`; that was a client component, a
transition and a dependency on JavaScript having loaded, for something a GET
form has done since 1995.

The export links are **ordinary links with no `download` attribute**, pointing
at a Next route handler. That handler reads the staff token server-side
(decision A1) and streams the CSV back with `Content-Disposition`.

## G. Public UI, media, notifications

**None.** §4.22 has no public surface, uploads nothing and sends nothing. Every
figure here is administrative — the screen says so, because it includes pending
and failed payments that the public site must never imply (A14).

## H. Tests

| Suite | Count | Covers |
| --- | --- | --- |
| `apps/api/src/common/csv.spec.ts` | 17 | formula injection, RFC 4180, header and filename safety |
| `packages/validation` | 20 | range bounds and ordering, real dates, the closed dataset list, the Indian financial year |
| `apps/api/test/reports.spec.ts` | 29 | authorization, the four views, reconciliation, readiness, re-auth, audit with row count, the tax-ID omission, a hostile campaign title |
| `e2e/admin-reports.spec.ts` | 11 | the screens, the URL range, the re-auth redirect, and two absences: no payment-changing button, no 10BD filing button |

### Three defects the tests caught

- **`Date.parse('2026-02-31')` does not fail** — JavaScript rolls it forward to
  3 March. A range typed as 31 February would have been accepted and quietly
  shifted, which is worse than a refusal: the report would be right about a
  period nobody asked for. Now checked by round trip.
- **`download` on the export link swallowed the re-auth redirect.** The browser
  treated the redirect as a file, so an operator clicking Export saw nothing at
  all — the worst possible answer to "confirm your password". Removed; the
  attachment header still produces a download.
- **"Donations" is both a sidebar item and an export link.** Fixed by making the
  export panel a labelled landmark, which is also what lets a screen-reader user
  tell the two apart.

## I. Known limitations and deferred work

1. **Form 10BD is not generated.** §4.22 asks for the readiness *view*, and that
   is what this is. `form_10bd_exports` is documented in
   `database-architecture.md` §12 and marked "a later phase" in the schema
   index; a button producing an unreviewed statutory filing would be worse than
   not having one. The screen says so and points at the donations export.
2. **`tax_documents` is likewise not built** — Form 10BE certificates are issued
   by the Income Tax Department, not by this platform.
3. **No charts.** The views return series (`byDay`) that a chart could render;
   the screens show tables. A table is readable, accessible and correct, and the
   requirement says "views", not "dashboards".
4. **Exports are built in memory**, which is why they are bounded. An unbounded
   export would need streaming and a different shape of route.
5. **`POST /admin/payments/reconcile`**, documented in `api-architecture.md`, is
   not built. The reconciliation *view* is; a route that re-queries the provider
   and moves donation states is payment-module work, not a report.
6. **`audit.export`** exists as a permission and has no route. The audit log has
   its own screen; exporting it was not asked for here.
7. **The dataset-permission rule cannot be exercised end to end.**
   `SUPER_ADMIN` holds every permission, so there is no lesser role to be
   refused as. The rule is asserted against the registry and enforced in the
   service.

## J. Production deployment — not executed

**Nothing to run.** No migration, and no seed: the permissions this phase uses
were seeded before it. Deploying the application code is the whole of it.
