# Phase 10.11 — Notifications

**Production was not touched.** No migration, seed, push, studio or admin
command ran against it. The migration is written and applied to `sailent_dev`
and `sailent_e2e` only.

---

## A. Scope, and where it comes from

The next documented module after DOCUMENTS (§4.20, Phase 10.10):

> **§4.21 NOTIFICATIONS** — "Transactional email via Brevo (receipts,
> confirmations, volunteer status, event reminders), in-app admin
> notifications, templates with versioning, and a send log."
>
> **Done when:** "every transactional email has a template, a log entry and a
> delivery status, and a failed send is retried and visible to admins."

Corroborated by `database-architecture.md` §12 (`notification_templates` and
the `notifications` columns), `information-architecture.md` §8.2 (a
**Communication** admin group) and `rbac.md` (`notification.send`).

## B. What was already there, and what was missing

| Already built | Missing |
| --- | --- |
| Brevo client, fail-soft by design | `notification_templates` — documented since Phase 0, never created |
| Nine transactional emails across four processors | Every body hard-coded in its processor |
| `notifications` as a send log, with status and error | `template_id`, `template_version`, `retry_count` |
| Retry: only `unreachable` throws, so BullMQ tries again | Any way for an administrator to see a failure |
| | A log entry for the sign-in code email — the one send that left no trace |
| | The bell, a "structural placeholder" since Phase 2 |

So the retry the acceptance criterion asks for already worked. What did not
exist was **"and visible to admins"**, and templates at all.

## C. Database

Migration **`0022_phase10_11_notifications.sql`** — additive only. Two new
tables, three new columns, two new indexes. Every new column is nullable or
defaulted, so existing log rows stay valid and unchanged.

- **`notification_templates`** — `slug` (UNIQUE), `name`, `channel`, `subject`,
  `body_html`, `body_text`, `variables` jsonb, `brevo_template_id`,
  `is_active`, `version`, `updated_by`.
- **`notification_template_revisions`** — a snapshot per save, UNIQUE
  `(template_id, version)`. The same shape as `page_revisions`, because
  "templates with versioning" has to mean history rather than a counter; §J
  records that the schema document specifies only the counter.
- **`notifications`** gains `template_id` (ON DELETE **SET NULL** — retiring a
  template must not delete the record that a real email reached a real donor),
  `template_version` and `retry_count`.
- Two indexes for the two reads this phase performs: the bell
  (`user_id, channel, read_at`) and the log (`channel, status, created_at`).
- **RLS on all three.** `notifications` holds donor email history and
  `notification_templates` holds the wording of everything the organisation
  sends.

## D. Templates, and the one unescaped variable

Nine templates, one per transactional email, seeded as reference data and
**upserted by slug without overwriting the wording** — an organisation that
rewrote its receipt email and lost it to a redeploy would, correctly, stop
trusting the editor. Only name, description and expected variables are
refreshed, because those belong to the code.

`{{variable}}` substitution is **escaped by default**. Every value is data
somebody else supplied — a donor's name, a campaign title — and interpolating
one unescaped is an injection into an email this organisation signs.

`{{{variable}}}` inserts raw, and exists for exactly one thing: a donation's
itemised table rows, which are a loop no substitution can express and which the
processor builds with every value already escaped. The registry names the one
slug permitted to use it, and **the API refuses a save that uses any other** —
because turning `{{donorName}}` into `{{{donorName}}}` is a one-character edit
that reads as a formatting tweak in a diff.

**A missing template is not an error.** Every processor keeps its built-in body
and falls back to it when a template is absent, inactive, or fails to load. What
is lost is editability, not delivery: an email with slightly old wording is an
inconvenience, a receipt that never arrives is a complaint.

## E. The acceptance criterion, clause by clause

**"Every transactional email has a template"** — nine slugs, nine rows,
asserted in both the API and E2E suites by name.

**"a log entry and a delivery status"** — already true of eight; the ninth,
`donor.login_code`, had none and now does. What that row does **not** contain is
the point: not the code, which is hashed precisely so it exists nowhere in
plaintext, and not the address, because the log is readable by anyone with
`notification.read` and a sign-in attempt is not theirs to browse.

**"a failed send is retried"** — unchanged, and correct already: only
`unreachable` throws, so BullMQ retries it and the permanent failures do not
delay the dead letter a human needs.

**"and visible to admins"** — new. A permanently failed send now writes an
in-app notification to every active staff member, the bell carries the count
(in its **accessible label**, not only in a coloured dot), and the send log
shows the reason and offers a retry. `not_configured` is deliberately excluded:
on a machine with no Brevo key every send reports it, and an inbox full of that
trains an administrator to ignore the feed.

## F. API and permissions

| Method | Path | Permission | Sensitive |
| --- | --- | --- | --- |
| GET | `/admin/notifications` | `notification.read` | no |
| GET | `/admin/notifications/unread-count` | `notification.read` | no |
| PATCH | `/admin/notifications/:id/read` | `notification.read` | no |
| POST | `/admin/notifications/read-all` | `notification.read` | no |
| GET | `/admin/notifications/log` | `notification.read` | no |
| GET | `/admin/notifications/failures` | `notification.read` | no |
| POST | `/admin/notifications/log/:id/retry` | `notification.send` | **yes** |
| GET | `/admin/notification-templates` | `notification.read` | no |
| GET | `/admin/notification-templates/:id` | `notification.read` | no |
| PATCH | `/admin/notification-templates/:id` | `notification.template.manage` | no |
| POST | `/admin/notification-templates/:id/revert` | `notification.template.manage` | no |
| POST | `/admin/notification-templates/:id/preview` | `notification.template.manage` | no |

Permissions **110 → 112**: `notification.read` and
`notification.template.manage`. `notification.send` already existed and was
already sensitive; this is the phase that finally uses it.

**Reading the log is not sensitive, and that is deliberate.** An administrator
checking whether a receipt went out should not meet a password prompt, or they
will stop checking — and a log nobody opens is not the visibility §4.21 asks
for. Re-sending is different: it puts a message in a real person's inbox.

**No public controller.** **No delete.** The log is evidence; an answer somebody
can edit is not.

### The retry is a closed map

`type` is a string on a row, so deriving a queue job name from it would let
anything that can write a notification row enqueue any job the worker knows.
Five types are retryable. Three are deliberately absent: `donor.login_code` (the
code is hashed and gone, and re-sending one on an administrator's say-so is an
account-takeover primitive), `volunteer.approved`/`rejected` (re-sending a
decision is a decision, and goes through the volunteer record), and
`event.cancelled` (a fan-out — retrying one row would re-notify everybody).

A retry **enqueues and leaves the failed row exactly as it was.** Overwriting
would destroy the only evidence of the first failure while claiming to fix it.

## G. Admin UI

Three screens under a new **Communication** sidebar group: `/admin/notifications`
(the inbox), `/admin/notifications/log` (the send log), and
`/admin/notification-templates` (+ `[id]`).

The bell is real, and its count is read **server-side by the layout** — the
admin UI never fetches from the API in the browser, because the token lives in
an httpOnly cookie (decision A1).

The template editor previews with **the same renderer the worker uses**. Two
implementations would eventually mean a preview that reassures somebody about an
email which goes out looking different. The rendered HTML is shown in a
`sandbox=""` iframe, not injected into the admin DOM: it is a body somebody is
editing and may have broken.

## H. Public UI, media, and what this phase did not touch

**None.** §4.21 has no public surface, uploads nothing, and the storage layer is
untouched.

## I. Tests

| Suite | Count | Covers |
| --- | --- | --- |
| `packages/validation` | 29 | escaping, raw-placeholder policing, missing values, the registry, schemas |
| `apps/api/test/notifications.spec.ts` | 32 | authorization, inbox scoping and the cross-user refusal, the log, retry gating and audit, template versioning, revert, preview |
| `e2e/admin-notifications.spec.ts` | 10 | the bell's accessible count, marking read, cross-user absence, the failure reason, the re-auth refusal, preview, versioning |

### Three defects the work caught

- **`db:prepare-e2e` had to be run before the seed would work** — the seed now
  writes a table that only migration `0022` creates. Caught by
  `credential-commands.test.ts`, which runs the real seed.
- **An E2E assertion matched the organisation's own address.** A regex for
  "anything email-shaped" caught `hello@sailentfoundation.org` in the admin
  shell and failed for a reason unrelated to the property. Now asserted against
  the actual addresses in the database.
- **Four more `waitForURL` calls in `admin-stories.spec.ts`** hit the App Router
  transition stall documented in phase-10.9 §H, surfaced by the extra load of a
  new spec. All four replaced with one helper that waits for the response and
  resolves the row — which asserts the stronger thing anyway.

## J. Known limitations and deferred work

1. **`notification_templates.version` is specified in the schema document; the
   revisions table is not.** A counter without history cannot answer "what did
   the receipt say in March", so the table was added following the
   `page_revisions` precedent. Flagged because it is the one place this phase
   went beyond the letter of the schema document.
2. **No `delivered` or `bounced` status.** `database-architecture.md` §12 lists
   both, and both come from Brevo webhooks that do not exist. Adding enum values
   nothing ever sets would be inventing a capability.
3. **Newsletter subscribers** is the fourth entry in the IA's Communication
   group and is not built: §4.21 does not name it, the table does not exist, and
   the public form says plainly that nothing is stored yet.
4. **Templates are email-only in practice.** The `channel` column carries SMS,
   WhatsApp and push, and no processor sends by any of them.
5. **A template's `variables` column is refreshed from the code**, so an editor
   cannot invent a variable — only use the ones the sender supplies. That is the
   intent, but it means adding a variable needs a code change.
6. **`brevo_template_id` is stored and unused.** The column is documented;
   sending through Brevo's own templates is not implemented.

## K. Production deployment — not executed

```
pnpm --filter @sailent/database db:migrate --target=production \
  --confirm-host=<exact production host>
```

```
pnpm --filter @sailent/database db:seed --target=production \
  --confirm-host=<exact production host> --reference
```

The migration is additive and idempotent. The reference seed takes production
from 110 to 112 permissions and inserts the nine templates; it **will not
overwrite** a template whose wording has been edited. Note it still deletes and
re-inserts every SUPER_ADMIN grant, as in previous phases.

Until the seed runs, every email keeps sending from its built-in body — the
fallback in §D is what makes deploying the migration and the seed separately
safe.
