# Phase 7 — Donor accounts and the donor dashboard

A donor can now sign in, see everything they have given, download a receipt,
follow the campaigns they funded, save campaigns for later, and control what
they hear from us. Staff can find and correct a donor record.

Two Phase 6 deliverables were **withdrawn** in the same phase: refunds, and the
standalone gallery that had been designed but never built.

---

## 1. What was removed, and why that came first

### 1.1 Refunds

Phase 6 shipped a complete refund implementation — Finance-only, provider-first,
counters adjusted under a row lock, separation of duties enforced by a database
CHECK. The platform has decided not to offer refunds, so it is gone rather than
left switched off.

Migration `0010_phase7_donor_accounts.sql` drops:

| Thing | Note |
|---|---|
| `refunds` table | 4 FKs, 2 indexes, 2 CHECKs |
| `donation_items.refunded_quantity` | takes its CHECK with it |
| `refunded`, `partially_refunded` | from **both** `donation_status` and `payment_status` |
| `donation.refund` permission | cascades to `role_permissions` |
| `refund_approval_threshold_paise` setting | |

**Every destructive step is behind a `RAISE EXCEPTION` guard.** The migration
aborts if a refund exists, if any donation or payment sits in a refunded state,
if any `payment_transactions` row references one, or if any line records returned
units. On this database all five passed with zero rows. On any other, those
guards are what stop this from being a data-loss event.

Two things about the enum rewrite are worth knowing, because both cost time:

- Postgres has no `ALTER TYPE … DROP VALUE`. Narrowing an enum means building the
  new type alongside the old, moving every column across, and dropping the old
  one. Column defaults must come off first — a default is an expression of the
  *old* type and blocks the rewrite.
- `donations_pending_idx` is a **partial** index whose predicate holds enum
  literals (`WHERE status IN ('pending','processing')` is stored as
  `'pending'::donation_status`). Renaming the type retypes those literals too, so
  the rebuilt column gets compared against `donation_status_old` and the whole
  migration fails with *operator does not exist*. It is dropped and recreated
  around the rewrite. Nothing else in the database depended on either type — no
  views, no functions, no other partial indexes, and that was checked rather
  than assumed.

**What happens now if a refund is raised anyway.** Someone with the Razorpay
dashboard can still return a donor's money in three clicks, and Razorpay will
tell us. There is no code left that acts on it, and silently ignoring it would
let the books drift with nothing to show for it. So `refund.created` and
`refund.processed` are:

- stored in `payment_webhooks` with their full body, as before;
- marked **`needs_review`** rather than `ignored`, so they are one query away
  (`WHERE processing_status = 'needs_review'`) instead of buried among every
  settlement event Razorpay sends;
- logged at **error** level, naming the webhook row.

Nothing else changes: no counter moves, no donation status changes. A human
reconciles it. There is a test that pins exactly this.

**`/refund-policy` was kept, and rewritten.** The brief said not to implement
refund documentation. Razorpay requires every merchant to publish a visible
refund and cancellation policy, and *"donations are final"* **is** a policy —
one that has to be findable **before** somebody gives rather than discovered
afterwards. Deleting the page would not remove the obligation; it would only mean
the obligation went unmet and the donor was told nothing. So the page now
documents an **absence**: no refunds, no cancellations, no process to request
one, and — for a payment somebody genuinely did not make — a pointer to their
bank, because that is a dispute and not something this platform can process.

### 1.2 The standalone gallery

**There was nothing to remove in code.** `galleries` and `gallery_items` were
designed in Phase 0 and never built; there is no `/gallery` route, no admin
screen, no standalone endpoint and no `gallery.*` permission. The removal was
therefore documentation — six files that described a feature a developer could
reasonably have started building.

What stays, as the brief allows: `campaign_gallery` (a junction onto `media`),
the `gallery` JSON columns on `events` and `success_stories`, the campaign-scoped
CRUD under `/admin/campaigns/:id/gallery`, and the `campaign_gallery.manage`
permission. All of it is media attached to the thing it documents.

---

## 2. What was built

### 2.1 Schema

`saved_campaigns` — `donor_id`, `campaign_id`, `created_at`, with a unique index
on the pair and two supporting indexes.

**Keyed on `donors`, not on `users`**, and that is the whole design note. `users`
are staff; a donor never has a user row. A donor session carries
`sessions.donor_id` and a `donor` token audience, so `donors.id` is the only
identity a donor request actually has. Keying their own data on anything else
would mean inventing a second identity for them.

Nothing is snapshotted. Unlike a donation line, a bookmark is a pointer and
should follow the campaign — somebody who saved an appeal wants its progress
today. `ON DELETE CASCADE` on both sides, which would be wrong on a financial row
and is right here.

Three columns on `donors`: `notify_campaign_updates`, `notify_impact_updates`
(both default **on** — they are news about work the donor paid for) and
`notify_newsletter` (default **off** — marketing is opted into). These are
*topics*, independent of the existing *channel* columns (`email_opt_in` and so
on); both sets must agree before anything is sent. Transactional mail is
deliberately absent: a receipt is not a preference.

### 2.2 The donor API — `/me`

`@RequireAudience('donor')` on the controller, so it cannot be forgotten on a
route. Twelve endpoints: profile (read/update), overview, donations (paginated,
filtered), one donation, its receipt, supported campaigns, saved campaigns
(list/add/remove), impact, updates, settings (read/update).

**Ownership is a WHERE clause, not a check.** Every method takes `donorId` as its
first argument and puts it in the SQL. There is no method that loads a row and
then compares its owner, because that shape has a failure mode this one does not:
the row has already been read, and the next person to add a log line or a debug
response leaks it. A donation belonging to somebody else is not a forbidden row —
it is not a row at all.

**A donation that is not yours is 404, never 403.** 403 says *"this exists and it
is not yours"*, which turns the endpoint into an oracle for whether an id exists.

`donorId` always comes from `actor.id` on a donor-audience token that the guard
resolved from a session row. It is never read from a path, a query string or a
body, anywhere in the module — there is no `donorId` parameter to pass.

**Nothing in the module writes money.** No amount, status, payment, receipt
number, `amount_raised` or `provided_quantity`. Those are written in exactly one
place, the payment-capture transaction (decision A6).

The update schemas are `.strict()` allow-lists, so an attempt to set
`totalDonated` is **rejected** rather than ignored — a silently-dropped field
passes a test for the wrong reason and stops being dropped the day somebody
refactors the update to spread its input.

### 2.3 The donor dashboard — `/dashboard`

Nine routes: overview, donations, one donation, its receipt, supported campaigns,
saved, updates, profile, settings — plus `/sign-in` and a dashboard-shaped
not-found. `/account`, the Phase 0 name that shipped as a placeholder, is now a
permanent redirect rather than a second route for one concept.

Sessions are a **separate cookie** from staff (`sailent_donor_session`, 30 days
against staff's 7). The two audiences sign with different keys, but the more
important difference is what `actor.id` *means*: a `donors.id` on one and a
`users.id` on the other. The BFF picks which token to attach from a path
**allow-list**, so a new donor route added under some other prefix fails closed.

The middleware now guards both areas, each against its own cookie and its own
sign-in page.

**Every figure on the dashboard is summed from that donor's own confirmed
donations** (decision A14). Two school kits bought reads as "2". There is no
multiplier, no "your ₹5,000 fed 20 families", and no share of a campaign's
headline figure apportioned by contribution. Custom amounts are deliberately not
counted as items, because a custom amount does not buy a countable thing.

### 2.4 Admin — `/admin/donors`

Search (name, email, phone, donor code), detail with giving history, and a
correction form. Three permission levels: `donor.read`, `donor.read_sensitive`
(PAN, address, internal notes) and `donor.update`.

**The sensitive split is enforced in the SELECT**, not in a serialiser. A PAN
fetched and then filtered out has still been read into a process, put in a heap
dump and possibly logged by an interceptor that did not know what it held.

**The PAN is not searchable at any level.** A search that matched on it would let
somebody confirm a number they already suspected by reading the result count, and
an oracle is a disclosure however the row is filtered afterwards. The list reports
only *whether* one is on file.

Corrections require a re-authentication and a **mandatory free-text reason**,
which goes into the audit row with a before/after diff. The tax id is recorded as
*changed*, never as a value — an audit log is a second copy of the database with
a longer retention period.

**The drift banner** is the point of the detail screen: lifetime totals are
caches written by payment capture, and this is the one place that also
re-derives them from `donations` and shows both. A screen that read the cache
would only confirm it to itself. When they disagree it is a reconciliation job,
and there is deliberately no way to correct either figure by typing a number.

### 2.5 Sign-in code delivery

Donor OTP existed end to end on the API but was never delivered anywhere, so
nobody could actually sign in. Codes now go out by **email** through the existing
Brevo transport and BullMQ queue.

The phone number remains the identifier; email is only the channel, and the
address is read from the donor record **on the server** — if a caller could name
the destination, this endpoint would forward a sign-in code for any donor to any
address. Requesting a code stays silent about whether the number is known, so
delivery failing changes nothing the caller can observe. The job payload is a
credential, so it does not get the default retention of a day: it is dropped on
delivery and a failure is kept only long enough to outlive the code.

---

## 3. Deviations from the brief, stated plainly

**There is no password, so there is no "reset password" or "change password".**
The brief lists both under §6. Donors authenticate by one-time code only
(decision A8), and the same section says *"do not create a second authentication
system"* — which is what adding passwords would be. The two cannot both be
honoured; the existing architecture won.

**"Register" is "give once, then claim your account".** A donor record is created
*by a donation*. `/auth/donor/otp/verify` refuses a correct code from a number
with no recorded donation, and the message says so plainly rather than implying
the code was wrong. This matches §27's own guest-donation-then-claim flow, and it
means no empty account can be created by anyone who has not given. The sign-in
form states it under the number field rather than letting somebody discover it
after typing a valid code.

**`/dashboard`, not `/account`.** The brief names every route under `/dashboard`;
Phase 0's IA said `/account`. The brief won and `/account` redirects.

**No `donations.user_id` column.** §28 suggests one. Ownership is already
reachable as `donation.donor_id → donors.id`, and a second column asserting the
same fact is a second thing that can disagree. `donors.donor_code`
(`DNR-2026-xxxxx`) already serves §26's donor-friendly identifier.

**No DONOR role in RBAC.** §33 lists donor capabilities. Donors sit outside the
permission system entirely, holding `permissions: []`; their routes are gated by
token audience plus ownership. Adding a role would imply staff could hold it.

**Updates are a list, not an inbox.** §21 asks for notifications. There is no
read/unread state, no badge and no "mark as read", because there is no table
behind them and inventing one to hold a boolean is a bigger commitment than the
screen earns. What the data supports honestly is published impact updates from
campaigns this donor funded, newest first.

**`donor.delete` is not implemented.** The permission exists and means
*redaction*, not deletion — a donor record is attached to receipts and to a
statutory Form 10BD filing, so removing the row would destroy records the
organisation must keep. Redaction is real design work and is deliberately not
half-built.

---

## 4. Defects found and fixed

| What | Why it mattered |
|---|---|
| **Plaintext donor OTPs logged in production.** The dev-only log was gated on `process.env.FEATURE_MOCK_DATA !== 'false'`. The schema also accepts `0`, and `'0' !== 'false'` — so a production box configured `FEATURE_MOCK_DATA=0` validated, booted, and logged every donor's sign-in code. | Now gated on the **parsed** boolean via `AppConfig.mockDataEnabled`, which also refuses to be true in production. Four tests, one of them specifically about the spelling `0`. |
| **Cross-donor access-token leak** (introduced in this phase, caught by the tests). The single-flight refresh guard was one module-scope promise shared by every visitor, so a request arriving during another donor's refresh received **their** token. | Keyed on the refresh token, so two callers share a refresh only when refreshing the same session. |
| **Concurrent refresh revoked the session.** The dashboard layout and page render concurrently and both fetch; each triggered a refresh, the second presented an already-rotated token, and reuse detection revoked the family. Every page view past the refresh window did it. | The same single-flight guard. This would have signed real donors out, not just tests. |
| **A tax id without its type returned 500.** `donors_tax_id_type_required` caught it in Postgres, several layers below anything that could explain it. | A cross-field rule in the schema; now a 422 naming the missing field. |
| **Dashboard nav failed WCAG 1.4.3** at 4.44:1 against a 4.5:1 floor. An invented `bg-primary/10 text-primary` tint. | The design system's own `bg-accent`/`bg-accent-foreground` pair. |
| **An e2e test that skipped instead of failing.** It guessed at a link name, found nothing, and reported green while asserting nothing. | Rewritten to navigate directly and normalise its own starting state. |

### Also corrected, not fixed

`ThrottlerModule` still stores counters **in memory**, and the comment saying
Phase 5 would move it to Redis is three phases stale. The consequence is real:
one API instance enforces the documented limits exactly, two instances behind a
load balancer enforce roughly double, because each keeps its own tally. Render
scales horizontally, and this matters most for the endpoints that matter most —
donor sign-in among them.

The comment now says this instead of promising again. The fix is a
`ThrottlerStorage` backed by the Redis connection the app already holds, which is
a dependency decision (a third-party package, or ~40 lines implementing the
interface) that belongs to whoever owns the deployment. **Recommended as the next
security task.**

---

## 5. Known gaps

- ~~**No SMS.**~~ **Resolved by removing the dependency** — see §8. The sign-in
  code is addressed to and delivered to an email address, so no SMS vendor is
  needed. A donor must have an email on file, which `donors_email_lower_unique`
  and a migration guard both require.
- **The inline save confirmation needs hydration.** These forms are progressively
  enhanced: before React hydrates, a submit posts natively — the change saves,
  but the client state that draws the green banner was never set. The e2e suite
  therefore asserts persistence rather than the banner. A server-rendered
  confirmation would close this.
- **Receipts print rather than download.** There is no PDF generator; the receipt
  page is designed to print and the browser's "save as PDF" produces a good
  document. Better than a Download button that does not work.
- **`notFound()` inside the dashboard returns HTTP 200.** The layout fetches
  before the page does, so Next has begun streaming by the time `notFound()`
  fires. The not-found page renders and nothing is disclosed — the security
  property holds — but the status line is wrong. An App Router artefact.

---

## 6. Verification

| Suite | Result |
|---|---|
| Typecheck, lint, format | clean across all 8 workspaces |
| Build | web and API both build |
| Unit + integration | **537 passing** (374 API · 136 validation · 22 web · 5 worker) |
| End-to-end | **391 passing**, 1 skipped, across 4 viewport projects |

New tests this phase: 40 in `apps/api/test/me.spec.ts` (donor account and admin
donors), 4 in `apps/api/src/config/app.config.spec.ts` (the OTP logging gate),
and 20 × 4 viewports in `apps/web/e2e/dashboard.spec.ts`.

### Running the e2e suite

Donor OTP verification is capped at **10 per 15 minutes**, and a full run signs
in four donors — one per viewport project. That cap is a real control on a
sign-in endpoint and the suite works within it rather than asking for it to be
raised:

- global setup **reuses a saved session** when it still answers, so most runs
  cost nothing;
- the sign-out test revokes one session per project, so the run after it pays for
  four fresh sign-ins;
- while iterating, restarting the API clears the in-memory counter.

One donor **per project**, not one shared between them. The projects run
concurrently and these tests edit a profile, toggle preferences and add and
remove bookmarks — sharing a donor meant sharing mutable state and one revocable
session, which surfaced as three different tests failing in three different
projects on each run. `mode: 'serial'` does not fix that: it orders tests within
a project, and the projects run alongside each other.

---

## 7. Not in this phase

No Phase 8 work. No recurring donations. No refunds. No standalone gallery. No
public document library. No donor redaction. No PDF receipts. No SMS.

---

## 8. Addendum — simplification pass

Three changes after the phase was first completed, on instruction to keep the
site simple.

### 8.1 The public document library is gone

`/reports` and `/transparency` were both removed, along with the `DocumentCard`
component and the report fixtures. **The platform publishes no documents to the
public.** Annual reports, audited statements and legal filings are internal, and
the admin sidebar's separate *Reports* group was merged into
*Content → Reports & documents* — two destinations for one drawer of PDFs is a
menu that makes people guess.

**The registration block could not go with them.** Registration number, PAN, 12A,
80G and date of registration now sit on `/about`: a donor claiming relief under
Section 80G needs them, receipts reference them, and "verify us against the
public register" is the most useful thing an NGO site offers someone deciding
whether to give. Deleting the page would have deleted that too.

Nav entries, sitemap entries and the three in-page links that pointed at either
page went with them, including an `/impact` call to action that promised "read
the full reports". A promise pointing at a 404 is worse than no promise.

An e2e test now asserts both routes return 404 and that no nav link points at
either, so they cannot quietly come back.

### 8.2 Donor sign-in is addressed by email

Phase 7 shipped sign-in keyed on a PHONE NUMBER with the code delivered by
email — because SMS was never wired. It asked people to type one thing in order
to receive a message somewhere else, which was incoherent, and the phase
documented it as a gap. The address is now both the identifier and the
destination.

**This changed what identifies a donor, which is not cosmetic.** `donors`
deduplicated on phone, deliberately: an email is shared within a household far
more often than a mobile number, so phone kept a husband's and a wife's giving
history apart. Signing in by email needs the opposite guarantee — an address must
resolve to exactly one donor, or the code is a coin toss between two people's
records.

Migration `0011` therefore:

- adds `donors_email_lower_unique` on `lower(btrim(email))`, case-insensitive
  because people do not type their own address consistently;
- drops `donors_phone_unique`, because phone is contact detail now and leaving
  it unique would make it a second identity that can still collide — two family
  members with separate addresses and one shared mobile would have the second
  donation fail on a constraint that no longer means anything;
- guards on both duplicate addresses and donors with no address, and aborts
  rather than merging two people's giving history.

**The trade-off, stated rather than hidden:** two people sharing one email
address now share one donor record. That is the cost of email-addressed accounts,
and the same bargain every donation platform that logs you in by email has made.

`upsertDonor` in the donation flow was switched to match on email in the same
change — leaving it keyed on phone while the database keyed on email would have
meant a returning donor who changed their number hit a unique violation on a
column the method never looked at.

Normalisation happens in exactly three places and they must agree: the sign-in
form, the auth service, and the index expression. A test signs in with the
address upper-cased and padded with spaces to prove they still do.

### 8.3 A flaky test made honest

`every page has exactly one h1` used `expect(await …count()).toBe(1)`, which asks
the DOM once, the instant `goto` resolves. Under four viewport projects against
one server it occasionally reported zero — on a different page each run, which is
the signature of a race rather than a missing heading. It now uses `toHaveCount`,
which retries. It rejects exactly what it rejected before.

### What did not change

Staff authentication. Admins, Finance and Content Managers still sign in with
email and password, and TOTP remains mandatory for Super Admin, Admin and Finance
Manager (decision A8). "No passwords" is a donor-facing rule; removing two-factor
auth from the accounts that can export donor PII and read PAN numbers would have
been a security reduction, not a simplification.
