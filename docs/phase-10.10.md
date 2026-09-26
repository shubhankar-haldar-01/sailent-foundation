# Phase 10.10 — Reports & documents

**Production was not touched.** No migration, seed, push, studio or admin
command ran against it. The migration is written and applied to `sailent_dev`
and `sailent_e2e` only.

---

## A. Scope, and where it comes from

The next documented module after CONTENT (§4.17, Phase 10.9) and BLOG (§4.18,
Phase 10.7). §4.19 GALLERY is marked **"Not in scope, and not deferred"**, so
the next thing that exists is:

> **§4.20 DOCUMENTS** — "No public document library. Annual reports, audited
> statements and policies are ADMIN-ONLY, under _Content → Reports & documents_;
> volunteer ID proofs and internal financials likewise. Nothing in this module
> is publicly reachable — the only documents a visitor sees are ones explicitly
> attached to a campaign and marked public."
>
> **Done when:** "a private document is unreachable without an authorised
> signed URL, and changing a document's visibility requires re-authentication
> and writes an audit row."

Corroborated by `information-architecture.md` §1.2 (`/reports` and
`/transparency` removed; documents "live in the admin under _Content → Reports
& documents_"), `database-architecture.md` §11, `security-architecture.md` §6
(buckets, magic bytes, five-minute signatures) and `rbac.md` (the three document
permissions in the matrix).

The admin sidebar already carried `Reports & documents → /admin/documents`,
marked `phase: 'Phase 4'`. That marker is now gone.

## B. What was already there, and what was missing

This is the shape Phase 10.5 found in `success_stories`: **a complete schema
with no write path.**

| Already present | Missing |
| --- | --- |
| `documents` table — every column, 3 indexes, 2 CHECK constraints, RLS enabled | Any way to create a row |
| `document_type` and `document_visibility` enums | Any way to upload bytes |
| 4 permissions, all granted | Any admin screen |
| A public read for campaign-attached documents | Any signed-URL issuer |
| `GET /admin/campaigns/:id/documents` | Everything that would put one there |

So **no new permissions and no new enums** — the catalogue already had
`document.read`, `document.read_private` (sensitive), `document.manage` and
`document.change_visibility` (sensitive). The count stays at **110**.

## C. Database

Migration **`0021_phase10_10_documents.sql`** — additive, idempotent, no table
created and no existing row touched. Three things the table lacked to support a
write path:

1. **`UNIQUE (file_key)`.** Two rows naming one object turn a single visibility
   change into a silent inconsistency: one says public, the other private, and
   the bytes can only be in one bucket.
2. **`CHECK (visibility <> 'public' OR published_at IS NOT NULL)`.** The public
   read filters on both; without this a row can satisfy the first half and not
   the second, and be invisible on the site while the admin screen calls it
   public. The converse is deliberately unconstrained — a withdrawn document
   keeps its `published_at`, because when it was published is a fact about the
   past.
3. **`INDEX (created_at DESC)`** — the order every page of the library is read
   in. The three existing indexes serve the filters, not the sort.

RLS was already enabled and is re-stated. This table holds audited financials,
internal policy papers and the location of every private object in the bucket;
without RLS, PostgREST would serve all of it through the `anon` key.

> **The unique index refused to build the first time**, on four rows left behind
> by an earlier test run. That was a real defect in the new spec — one test
> renamed a document to a title outside the `afterAll` cleanup pattern — and the
> storage fake compounded it by minting the same keys (`test1`, `test2`, …) on
> every run. Both fixed; the fake now carries a random segment like the real
> `buildKey`.

## D. Storage

`buildKey` gained one line: `application/pdf → pdf`. Nothing else in
`StorageService` changed.

**`document-inspection.ts`** is new and is the only substantive addition:
magic-byte validation for PDF, falling through to the existing image inspector
for scans.

**PDF and the three image formats, nothing else.** §6 also lists Word and Excel
among "specific document formats"; they are refused, and the reason is not
effort. An OOXML file is a zip whose members can carry macros, and proving one
safe means reading inside the archive — a real parser, a real dependency and a
real attack surface, to support a format nobody should file a statutory report
in. The refusal names the remedy ("export it as PDF") rather than saying
"unsupported file", because one of those is actionable.

Size cap 25 MB and signatures of **five minutes**, both from §6, and both
enforced twice — multer refuses the stream, the service checks the buffer again.

## E. The acceptance criterion, clause by clause

**"A private document is unreachable without an authorised signed URL."**
Three things make that true, and all three are needed:

- The private bucket has no public hostname, so there is no URL to guess.
- `visibleTo()` is applied **as a WHERE clause**, not as a check after the
  fetch. An actor without `document.read_private` cannot list a private
  document, cannot fetch it by id, and gets **404 rather than 403** — because
  "forbidden" confirms the id names something real, which is the one fact the
  permission exists to withhold.
- The signature expires in five minutes, and **every issue is audited**,
  including for public documents: a log that records only the private ones
  cannot answer "who read the audited financials before they were published".

**"Changing visibility requires re-authentication and writes an audit row."**
`PATCH /admin/documents/:id/visibility` is the module's only `@Sensitive()`
route. The reason is **required by the schema** and lands on the audit row —
"private → public" without a why is not much of a record. Publishing is filed at
`warning`, not `info`.

## F. Visibility is not a column update

R2 exposes a whole bucket or none of it, so "make this public" cannot be a flag.
The bytes have to move, and the order is chosen so that no failure leaves a
private document readable:

1. Copy to the destination bucket, **under a new key**.
2. Point the row at the new key, in a transaction.
3. Delete the old object.

A failure at 1 changes nothing. A failure at 2 leaves an unreferenced copy. A
failure at 3 while **withdrawing** is the one case that matters — the row says
private and the public copy is still being served — so it is recorded at
`critical` and the call reports failure rather than claiming the document is
withdrawn.

## G. API and permissions

| Method | Path | Permission | Sensitive |
| --- | --- | --- | --- |
| GET | `/admin/documents` | `document.read` | no |
| GET | `/admin/documents/:id` | `document.read` | no |
| POST | `/admin/documents` | `document.manage` | no |
| PATCH | `/admin/documents/:id` | `document.manage` | no |
| PATCH | `/admin/documents/:id/visibility` | `document.change_visibility` | **yes** |
| POST | `/admin/documents/:id/download` | `document.read` | no |

**No public controller**, which is the module's defining property.

**No DELETE route, and no `document.delete` permission exists.** The catalogue
has four document permissions and destruction is not among them — the same
decision `success_stories` made. Withdrawal is a visibility change, which keeps
the row and the audit trail. Uploading is deliberately *not* sensitive: an
upload lands private, so the worst an unattended session can do is put a file
where only staff can reach it.

Download is a **POST**, because it issues a credential, counts a download and
writes an audit row. A GET that did those things would be prefetched by a
browser and retried by a proxy.

## H. Admin and public UI

`/admin/documents` and `/admin/documents/[id]`. The list says, in the heading
copy, that nothing here is published to the website — an editor who assumes
otherwise costs the organisation a document on the internet.

Visibility is its own panel with a two-step confirmation, a required reason, and
a warning that names what will happen in words. A field inside a "Save changes"
form is a field somebody changes on the way past.

Download links are fetched **on click**, not rendered into the page: a
five-minute signature baked into server-rendered HTML is expired before a slow
reader reaches it, and minting one per row per render would audit accesses that
never happened.

**Public:** the campaign detail page now renders its attached public documents —
the only route by which a document reaches a visitor. The API already filtered
these correctly; nothing rendered them.

## I. Tests

| Suite | Count | Covers |
| --- | --- | --- |
| `packages/validation` | 23 | the private-by-default rule, financial-year ranges, the required reason, that metadata cannot carry visibility |
| `document-inspection.spec.ts` | 10 | real bytes — PDF, scans, a script named `.pdf`, a polyglot, office formats, SVG |
| `apps/api/test/documents.spec.ts` | 32 | authorization, the bucket move and its single remaining copy, re-auth, audit rows, signed-URL expiry, no delete route, key never derived from the filename |
| `e2e/admin-documents.spec.ts` | 8 | the screen's claims, the storage-unconfigured refusal, no public route, re-auth in a browser |

**The E2E suite does not upload.** `playwright.config.ts` blanks the R2
credentials on purpose so the browser suite can never write real buckets — the
precedent `admin-media.spec.ts` set. The storage half is covered against
`fakeStorage()`, which models the two buckets as separate namespaces.

### Three defects the work caught

- **A `'use client'` module exported `formatBytes`, and the server page called
  it.** React refuses: a function exported from a client module is a client
  *reference*, not a function. Moved to `lib/admin/documents.ts`.
- **The client component imported the `server-only` API client** to fetch a
  signed URL — caught by the build, and correctly: that would have put a staff
  token in JavaScript to save a hop (decision A1). It is a server action now.
- **`db:prepare-e2e` had been broken since the target guard was tightened.** It
  spawned `db:migrate` without `--target=local`, so preparing the E2E database
  failed outright the first time a migration landed after that change. Fixed.

## J. Known limitations and deferred work

1. **No Word or Excel**, though §6 lists them. §D says why; exporting a PDF is
   the remedy the error names.
2. **No delete**, by design (§G). An upload made in error is withdrawn by
   visibility, not destroyed. If a genuinely wrong file is ever uploaded, the
   object must be removed out of band.
3. **The E2E suite cannot exercise a real upload** (§I), by the same fence that
   protects the real buckets.
4. **`document.read_private` is not separately exercisable end to end** —
   `SUPER_ADMIN` is the only staff role and holds every permission, so the
   filter is asserted against the query rather than by logging in as a lesser
   role. There is no lesser role to log in as.
5. **Volunteer and tax documents keep their own tables.** §4.20 names them as
   admin-only, and they are; `volunteer_documents` and `tax_documents` are
   separate schemas and out of this module's scope.
6. **`related_type` is polymorphic**, so the database cannot carry a foreign
   key. The campaign is checked in the service instead of nowhere.

## K. Production deployment — not executed

```
pnpm --filter @sailent/database db:migrate --target=production \
  --confirm-host=<exact production host>
```

The migration is additive and idempotent. **No seed is needed** — the four
permissions already exist in production and are already granted, so the count
stays at 110 and `db:seed --reference` has nothing to add here.

One caution: the `UNIQUE (file_key)` index will fail to build if production
somehow holds duplicate keys. It holds **zero** document rows as of this phase,
so it cannot — but if that changes, check before applying.
