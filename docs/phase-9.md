# Phase 9 — Team, events and impact

Written for: whoever picks this codebase up next. It assumes you have read
`phase-0-decisions.md` and knows the shape of the platform, and it explains the
things you would otherwise have to work out from the diff.

Phase 9 adds three domains that were already in the database and had public
read pages, and gives each of them the half that was missing: administration,
and — for events — the thing that makes an event page worth having, which is
being able to register for it.

---

## 1. What was already there, and why almost nothing new was created

`team_members`, `events`, `event_registrations` and `impact_updates` were all
created in Phase 3. Public list pages for `/team`, `/events` and `/impact`, and
a detail page for `/events/[slug]`, have existed since Phase 2.

So this phase added **four columns and one constraint change**, not four tables:

| Migration | Change |
|---|---|
| `0012` | `impact_updates.slug`, `impact_updates.cover_image`, `impact_updates.event_id`, `events.registration_deadline`, `events.organizer` |
| `0013` | Widened `impact_updates_has_parent` to admit `event_id` |

`0012`'s slug backfill derives from the title and suffixes a fragment of the id
on collision, then makes the column `NOT NULL` and unique in the same
migration.

`0013` exists because the Phase 3 constraint read
`campaign_id IS NOT NULL OR program_id IS NOT NULL`, which makes an update
attached only to an event unwritable. That is exactly the case the brief
describes: a medical camp counts its own patients seen, and those figures
belong to the camp rather than to whichever campaign paid for it. The rule being
kept is decision A14's — an update must attach to *something* — and widening the
constraint keeps it while admitting the third parent.

Everything else was reused:

- **`SlugService`** gained three entity kinds (`team`, `event`, `impact`)
  rather than a second implementation. `slug_history.entity_type` was already a
  free-form varchar, and every obligation it enforces — no collision with a
  retired slug, a history row written inside the renaming transaction — applies
  to a team member's URL exactly as it applies to a campaign's.
- **Permissions**: `event.*`, `team.*` and `impact.*` already existed. One was
  added, `impact.update`, mirroring `story.update`; the alternative was letting
  `impact.create` cover edits, which conflates "may write a new draft" with "may
  rewrite a number that is already on the site".
- **Notifications** go through the existing `notifications` table and the
  existing BullMQ `email` queue. No new queue, no new table.
- **Authentication** is the Phase 7 donor session, unchanged. No new audience,
  no new sign-in path.

---

## 2. An event has two states, and they are not the same question

This is the one design decision worth reading before the code.

```
status              draft | published | archived          — can anyone see it?
registrationStatus  open | closed | full
                    | cancelled | completed               — what is happening?
```

Both columns existed already. Merging them into one enum, the way `campaigns`
does, was considered and rejected, because **a cancelled event must stay
visible**. Everyone holding a registration needs to land on that page and read
that it is off, and `archived` is a 404 to the public — so cancellation cannot
live on the publication axis without hiding the notice from precisely the people
it is for. The same argument applies to `completed`: a past event is part of the
public record.

The transition tables live in `packages/validation/src/domain/event.ts`, shared
between the API that enforces them and the admin UI that renders the buttons,
and served from `GET /admin/events/transitions` so the UI cannot drift.

Two consequences that look odd until you know the reason:

- **`full` is never a button.** It is set by the server from the seat count it
  has just written. An operator who wants registration shut uses `closed`, which
  keeps the two distinguishable — so a cancellation that frees a seat can reopen
  a `full` event without reopening one somebody closed on purpose.
- **`cancelled → closed`, never `cancelled → open`.** Cancellation emails have
  gone out by then. Reinstating an event brings it back with registration shut,
  so somebody has to look at the attendee list and reopen it deliberately.

**Archiving is refused while live registrations exist.** Cancel it first — that
notifies people — and archive afterwards.

---

## 3. Capacity, and the race the brief names

> Capacity 100, 99 registrations, two users register simultaneously. The system
> must not create 101 registrations.

`EventRegistrationsService.register()` opens a transaction, takes
`SELECT … FOR UPDATE` on the **events** row, and does everything else while
holding it. The second request blocks on that lock until the first commits,
then reads the new count and is refused. The lock is on `events` rather than on
`event_registrations` because the row being protected is the one holding the
count.

The seat count is **recomputed from the registration rows inside that lock**
rather than trusted from `registered_count`. Same cost — one aggregate on an
indexed column — and it makes the cached counter self-correcting instead of
something that can drift silently and start admitting an extra person.

Three other guarantees, and where each actually lives:

- **No duplicates** — the `event_registrations_unique` index on
  `(event_id, email)`. A database constraint, not a service check, because a
  service check would race exactly the way a naive capacity check does. The
  service check that produces the readable message is a convenience on the
  ordinary path, not the guarantee.
- **No registration after the deadline, or for a cancelled, completed,
  unpublished or archived event** — `registrationAvailability()`, evaluated
  against the locked row.
- **A donor may only touch their own registration** — there is no `donorId`
  parameter anywhere in the donor-facing controller. Ownership is a WHERE
  clause, and somebody else's registration is 404 rather than 403.

There is **no waitlist**. `waitlisted` is in the column's vocabulary and nothing
in Phase 9 produces it. The brief lists what registration must prevent and does
not ask for a queue, and a half-built waitlist that promotes nobody is worse
than none.

**Cancelling and re-registering reuses the same row.** The unique index covers
cancelled rows too, so without that path somebody who changed their mind would
be permanently barred from an event with free seats.

**A registration cannot be cancelled once attendance is recorded.** Letting it
happen would replace "this person came" with "this person withdrew", and the
attendance register says one of those is false.

---

## 4. Registration requires an account, and that is a decision

§49 says a person may create, view and cancel their own registration and
nobody else's. Ownership has to be anchored to something the server
established: a guest registration identified by an email typed into a form is
owned by whoever types that email, so anyone could cancel a stranger's place,
and the cancellation notice would go to the stranger.

The cost is low, because the account is the existing passwordless one — an
email address and a six-digit code, nothing new built. `/sign-in` now takes a
`next` parameter so somebody bounced from an event page lands back on it;
the value is validated as "starts with a single `/`" before any redirect,
because "sign in and you will be taken somewhere" is the shape of a phishing
link.

The registration form asks for a name, a phone number and a headcount. **It does
not ask for an email address**, and the API refuses one: the address is the
unique key on a registration, so a client-supplied address would let anyone
register under somebody else's and lock the real owner out.

---

## 5. Impact records and decision A14

These rows are the evidence behind every public number that is not a live
database aggregate. Two rules, both enforced at the **publish** transition
rather than at save, so a draft can be written before the count comes back from
the field:

1. **A claimed figure needs a stated method.** `verificationMethod` is required
   whenever `metricValue` or `metricType` is set. A narrative update that claims
   no figure publishes freely.
2. **A record needs a parent** — campaign, programme or event. The database
   enforces it too.

`verifiedBy` is stamped from the authenticated actor at publication and is not a
field anybody can type into: the point of it is that it names the person who put
their name to the number.

`/impact/[slug]` renders the method **beside the figure**, not in a tooltip or an
expandable. A page that shows "1,240 children reached" and keeps the method in
the admin has published the claim and withheld the evidence.

`getImpactRecord` is the only content loader in the web app with **no fixture
fallback**. An impact record is a specific, dated, sourced claim; serving a
made-up one during an API outage would be exactly the fabricated statistic A14
exists to prevent. A 404 is the honest answer.

---

## 6. What was removed

**The refund policy page, its footer link, its sitemap entry and the FAQ entry**
(§59). `src/app/(public)/refund-policy/` is gone.

One thing to know, recorded here because it is the kind of thing discovered at
the worst moment: **Razorpay's merchant terms require every merchant to publish
a visible refund and cancellation policy.** "Donations are final" is one, and it
now lives nowhere on this site. If Razorpay asks for it during onboarding or a
review, it needs hosting somewhere. The note is repeated in `site-config.ts`
beside the footer row so whoever is asked knows it is absent deliberately.

The FAQ that asked "Can I get a refund?" was replaced rather than deleted, with
"What if I was charged twice, or for a payment I did not make?" — that is a
payment dispute rather than a refund, it is handled by the card network, and
somebody in that situation still needs to know where to go.

---

## 7. Defects found and fixed

### 7.1 No donor confirmation email had ever been enqueued

`donation-capture.service.ts` built its job id as
`` `donation-confirmation:${receiptNumber}` ``. **BullMQ refuses a colon in a
custom job id and throws** — it uses `:` to namespace its own Redis keys. The
enqueue is wrapped in a `.catch()`, correctly, so that a queue outage cannot
fail a donation that has already taken the money — and that `.catch()` was
swallowing the throw. Every thank-you email was being discarded at that line,
logged as a warning nobody was reading.

Found because the Phase 9 registration job hit the same wall, loudly, in a test.

Fixed with `jobKey(...parts)` in `queue.service.ts`, which joins parts with a
separator BullMQ accepts and strips anything outside `[A-Za-z0-9_.-]`. All three
call sites use it. A call site that cannot type the separator cannot get it
wrong. Five unit tests cover it, including that `a:b` and `ab` stay distinct —
a silently shared id makes the second job a no-op.

### 7.2 A cancelled event rendered as "registration closed"

`lib/content/events.ts` typed `registrationStatus` as
`'open' | 'closed' | 'full' | 'waitlist'`. `waitlist` is not one of the enum's
values and `cancelled` and `completed` are, so a cancelled event fell through
the status mapping and rendered as merely closed — to the people holding a place
at it.

### 7.3 The event page promised a waitlist that does not exist

The detail page badged a full event "Waitlist only", and the registration form
offered to "Join the waitlist". Nothing has ever implemented one.

### 7.4 Ordering in the registration panel

Two orderings were tried and both were wrong before settling:

- Session first, availability second, sent a signed-out visitor to a sign-in
  form so they could reach a registration form that does not exist, because the
  event was full.
- Availability first, registration second, told somebody who *had* a place at a
  full event that the event was full — hiding their own booking, and the joining
  link with it, precisely because other people had booked.

The order is now: do you hold a place → can anybody join → are you signed in.

### 7.5 Test residue reaching the public site

`catalog.spec.ts` created impact updates against a *seeded* campaign and its
teardown only swept updates hanging off campaigns the suite created, so "Spec
update" accumulated on every run. Invisible until Phase 9 gave impact updates a
public page, at which point they appeared on `/impact`.

Fixed there, and the two new suites tear down by a regex on the eight-hex
suffix their fixture titles carry — not by a title prefix, which would also have
matched the seeded records.

### 7.6 The header called the API on every page view

`AccountBadge` renders in the site header, so it renders on every page. It
fetched `/me` to get a signed-in donor's initials — **one authenticated round
trip per page view, on every public page, for two letters in a 40px circle.**

The donor session already carries the id and permissions; it now carries a
display name too, returned by the endpoint that issues the session (the donor
row is already loaded there to check the account exists, so it costs no extra
query). `updateDonorProfile` rewrites the stored name, which is the one place it
can change; the field is optional, so a session written before it existed keeps
working.

Noticed because it was pushing the e2e suite past the API's 100-requests-a-
minute limiter — all four viewport projects reach the API from one address — but
the cost was real in production too, where it would only ever have shown up as
latency. 429s in a full suite run went from 44 to 4.

### 7.7 Super Admin and Finance could not sign in at all

The staff login form is two-step for an account with TOTP: email and password,
then the code field appears. **React 19 resets an uncontrolled form once its
action completes**, so the moment the code field appeared the email and
password were wiped, and the second submit went out with no credentials.

It surfaced as *"Those details do not match an account"* — true, and completely
misleading: the details were right, the form had thrown them away. Only Super
Admin and Finance were affected, because they are the only roles with a second
factor, so it read as a wrong password on exactly the two accounts nobody could
easily test.

Every existing test passed, because the single-step path hides it: a success
navigates away and a failure means retyping anyway. The API was answering
correctly throughout, so no API test could have caught it either.

Fixed by holding both fields in client state — the password lives only there
and is never written into the rendered HTML, which a `defaultValue` fix would
have done. `e2e/admin-auth.spec.ts` now drives the whole two-step flow with a
real TOTP code, desktop-only because staff sign-in is capped at five attempts a
minute and the test costs two.

### 7.8 A flaky integration test of my own making

The capacity race test created its eight donors with `Promise.all`, which put
eight simultaneous sign-in requests — each with its own inserts and pool
checkout — on top of the other spec files vitest runs in parallel. That surfaced
as an intermittent `ECONNRESET` in a *different* test on each run, roughly one
run in three: exactly the kind of failure that gets written off as flaky CI
while hiding a real one.

The donors are now created one at a time. Signing them in is setup; only the
registrations race, and that race is untouched.

### 7.9 Seeded counters with nothing behind them

The seed wrote `registered_count: 52` against an empty `event_registrations`
table. The new admin list recomputes seats from the rows and shows the figure
beside the cached column precisely so a disagreement is visible — so every
seeded event opened with a drift warning, which trains an operator to ignore the
one warning that matters. The seed now writes matching registrations, which also
makes the attendee list and the attendance register demonstrable.

---

## 8. Deviations from the brief

- **Two team permissions, not five.** `team.read` and `team.manage`, following
  `event.*`. Publishing and archiving a team member are status changes on a
  record the caller may already edit — somebody who can rewrite a biography can
  already change what the public reads, so a separate permission for the last
  step is ceremony rather than control. `impact.*` keeps its separate
  `impact.publish` for the opposite reason: publishing a figure stamps you as
  its verifier.
- **No waitlist**, as above.
- **Registration requires a donor session**, as above.
- **Re-authentication had no UI at all.** `event.registration.read` is marked
  sensitive, so the attendee list returns 403 `REAUTH_REQUIRED` until a password
  has been re-entered within five minutes — and nothing in the web app could do
  that, which would have made the route permanently unreachable. `ReauthPanel`
  was added for it, and it renders in place of the content rather than over it,
  because the data was never fetched and a modal over an empty page implies it
  is merely covered.

---

## 9. Known gaps

- **`/me` is still fetched twice on `/dashboard/profile`** — once by the
  dashboard layout and once by the page, which renders inside it. The header
  badge's call was removed (§7.6); these two remain. Deduplicating them means
  `React.cache()`, which Phase 7 deliberately stepped back from for
  donor-scoped data, so it is recorded here rather than changed late. Two calls
  on one page is a fraction of the cost the badge carried, which was one on
  *every* page.
- **Building the web app while the API is down** leaves `/impact/[slug]` with no
  prerendered paths and the route then fails with `DYNAMIC_SERVER_USAGE` at
  request time. `/team/[slug]` survives it only because its loader has a fixture
  fallback and `getImpactRecord` deliberately has none (§5). Build with the API
  reachable.
- **The throttler is still in-memory**, carried over from Phase 7 §4 — limits
  are per-process and weaken as soon as a second API instance exists.
- **No reminder email before an event.** The brief lists it among possible
  notifications; the confirmation says when and where, and nothing sends a nudge
  the day before. It needs a scheduled job rather than an event-triggered one,
  which is the only reason it is not here.
- **No `Article` structured data on `/impact/[slug]`.** `buildMetadata` already
  emits Open Graph `article`, and JSON-LD `Article` on an organisational report
  that is not news is the kind of over-markup §44 warns against. `/team/[slug]`
  does carry `Person`, which is unambiguous.

---

## 10. Verification

```
pnpm -r typecheck     clean
pnpm -r lint          clean
pnpm format:check     clean
pnpm -r test          617 passed
pnpm --filter @sailent/web exec playwright test
                      452 passed, 4 skipped
```

The 617 are 434 API, 156 validation, 22 web and 5 worker. The new integration
suites are `apps/api/test/events.spec.ts` (29) and
`apps/api/test/team-impact.spec.ts` (18); the new unit suites are
`packages/validation/src/__tests__/event.test.ts` (20) and
`apps/api/src/modules/queue/queue.service.spec.ts` (5).

**Run the integration suites with the dev servers stopped.** Each spec file
boots its own Nest app with its own connection pool, vitest runs several at
once, and a live API and web server on top of that intermittently exhausts
Postgres — surfacing as `ECONNRESET` in a different test each run. It is
contention, not a defect, but it costs an hour to work that out from scratch.

The test the events suite exists for fires eight concurrent registrations at a
three-seat event from eight distinct donor sessions and asserts three
successes, five conflicts, and three seats held in the database. It is not a
test that can be written against a mock: a mocked database has no row locks, so
a broken check-then-write passes every time.

The skips are correct: the mobile navigation drawer does not exist at desktop
width, and the staff sign-in test runs on one project because the endpoint is
rate limited.

**Restart the API between back-to-back full runs.** Its rate-limit counters are
in memory (see §9), so a second run inside the same minute starts with the
budget already spent and fails on the limiter rather than on the code.

The e2e suite needs `DATABASE_URL` in the environment and both servers running.
**Build the web app after starting the API** — see the gap in §9, and note that
`pnpm build` at the repository root will not do this for you if the API is down.

---

## 11. Not in this phase

Phase 10. Nothing here starts it.

Also not here, and still permanently excluded: recurring donations, monthly
giving, subscriptions, auto-debit, refunds, a standalone gallery, public
reports or transparency pages, and user-created fundraising.
