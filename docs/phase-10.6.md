# Phase 10.6 — Media Library and Storage

**COMPLETE.** Both buckets exist, `R2_PUBLIC_BASE_URL` is set, and the real R2
round-trip has run against the live service — 9 tests, all 16 checks, three
consecutive clean runs, every object removed afterwards. See §E for the actual
results.

---

## A. What was already there

`media` has existed since Phase 3 with **no API, no permissions, and nothing
ever uploaded**. Its 15 rows are metadata pointing at storage keys like
`demo/campaigns/school-kits-jharkhand/1.jpg` with `url = NULL`; the public site
renders a deterministic placeholder from the key. `campaign-content.service.ts`
creates media rows from a *supplied* key — there was simply nowhere to put a file.

There was **no storage implementation at all**: no SDK, no service, no signed
URLs. `.env.example` declared Cloudflare R2 variables marked `[PHASE 4]`, and
`packages/config/src/env.ts` did not declare them, so the application could not
read them even if they were set.

### The schema needed no migration

| Column | Note |
|---|---|
| `storage_key` | UNIQUE, NOT NULL |
| `url` | nullable — and `media_private_has_no_url` **already enforces** that a private row cannot carry one |
| `alt_text` | **NOT NULL** — accessibility enforced in the database |
| `visibility` | enum `public \| private` |
| `mime_type`, `size_bytes`, `width`, `height` | populated from the file itself |

Two things the brief assumed are absent and were **not** added: there is no
`filename` column and no `deleted_at`. Deletion is therefore hard, which is why
it is reference-checked rather than merely permissioned.

---

## B. Storage architecture

```
browser → server action → API → StorageService → R2 (S3 API)
```

The browser never talks to R2 and never sees a credential. A presigned
direct-to-bucket upload would be fewer hops and would put the magic-byte check,
the size limit and the key generation on the wrong side of the trust boundary.

**Nothing outside `storage.service.ts` imports an S3 client, names a bucket, or
builds a URL from a key.** R2 is reached through the S3 API because it speaks S3
natively; a Cloudflare-specific SDK would tie the abstraction to the provider it
exists to hide.

### Two buckets, and why one will not do

R2 public access is **per-bucket, not per-prefix**. A single bucket is either
public — in which case nothing in it is private — or not, in which case every
image on the public website needs an expiring signed URL, losing CDN caching and
breaking shared links.

> **⚠ The current account has ONE bucket** (`sailent-foundation-storage`) and the
> public/private variables are commented out. The code, `.env.example` and the
> `media_private_has_no_url` constraint all assume two. §E has the steps.

### Storage keys

```
media/<yyyy>/<mm>/<32 hex chars>.<jpg|png|webp>
```

**The original filename is not part of the path — not sanitised, not slugified,
not used.** Every scheme that "cleans" a filename is one somebody eventually
gets past: `../`, encoded separators, a collision that silently replaces an
existing object, a trailing `.html` that changes how a browser treats the
response. The extension comes from the type the *bytes* were proved to be.

### Environment

`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET_PUBLIC`, `R2_BUCKET_PRIVATE`, `R2_BUCKET_TEMP`,
`R2_PUBLIC_BASE_URL`. **None are `NEXT_PUBLIC_`.** Optional in development —
most of the application never touches storage, and demanding credentials to run
the test suite would tax unrelated work — and **required in production**, so a
deployment cannot accept an upload with nowhere to put it.

---

## C. Upload validation

**The declared content type decides nothing.** `image-inspection.ts` reads the
bytes: JPEG (`FF D8 FF`), PNG (8-byte signature), WebP (`RIFF`…`WEBP`), and
parses dimensions from each. No dependency — `file-type` and `sharp` both do far
more than is needed, and `sharp` is a native binary with an install step.

| Rule | Where |
|---|---|
| Real type from magic bytes | `inspectImage` |
| ≤ 10MB | multer (before buffering) **and** the service |
| Alt text required | Zod, and NOT NULL in the database |
| Unguessable key | `StorageService.buildKey` |

**SVG is refused**, with a message explaining why rather than falling through to
"unsupported": it is XML, it can carry `<script>`, and serving one from the
public bucket is serving active content from the organisation's own domain.
Supporting it safely needs sanitisation this project does not have.

The JPEG marker walk is **bounded twice** — offsets must strictly increase and
the walk is capped — because segment lengths come from the uploader. A test
feeds it `FF D8 FF` followed by 8KB of `FF` and asserts it terminates.

---

## D. Behaviour

**Consistency.** Neither operation can be atomic across a database and an object
store, so the order is chosen for survivable failure: **upload** writes the
object then the row; **delete** removes the row then the object. Both failure
modes are the same one — an unreferenced object, never a dangling reference.

**Visibility changes move the object** (copy, then delete). Flipping the column
alone would leave a "private" image still served from a public URL anybody who
saw it once can keep using. A test asserts exactly one copy survives.

**Deletion is reference-checked in the service.** `campaign_gallery.media_id` is
`ON DELETE CASCADE`, so the database would *not* stop a delete — it would
silently empty a gallery. A regression test proves the refusal and that nothing
is destroyed on the way to it.

---

## E. The real R2 round-trip

### Setup, as it now stands

Two buckets exist — `sailent-public` and `sailent-private` — and public access
is enabled on the first via its r2.dev address, which is what
`R2_PUBLIC_BASE_URL` points at. (`sailent-foundation-storage` is an older empty
bucket and is not part of this architecture; nothing reads or writes it.)

`R2_BUCKET_NAME` appears nowhere — not in the code, not in `.env`, not in
`.env.example`. There was no legacy single-bucket variable to remove, and
nothing is silently mapped onto either bucket.

`R2_BUCKET_TEMP` **was** declared in `packages/config/src/env.ts` and read by
nothing, so it has been removed rather than left as a variable an operator
would feel obliged to set.

### What ran

`apps/api/test/r2-round-trip.spec.ts` — the real `StorageService`, the real
`MediaService`, the real buckets, no fake anywhere. It is guarded by
`describe.skipIf(!configured)`, so a checkout without credentials skips it
instead of failing.

| # | Check | Result |
|---|---|---|
| 1 | Upload a real JPEG, PNG and WebP | pass |
| 2 | The object exists in the expected bucket | pass |
| 3 | The media row has correct type, size and dimensions | pass |
| 4 | The public URL resolves and returns the image | pass |
| 5 | A private upload has `url = NULL` | pass |
| 6 | Its signed URL resolves | pass |
| 7 | Public → private moves the object and clears the URL | pass |
| 8 | Private → public moves it back and restores the URL | pass |
| 9 | Exactly one copy exists after each move | pass |
| 10 | Delete removes both row and object | pass |
| 11 | A referenced image cannot be deleted | pass |

```
✓ 1–5. uploads a JPEG to the PUBLIC bucket, records it, and serves it
✓ 2.   uploads a PNG and a WebP, reading their real dimensions
✓      refuses a disguised file against the real bucket too
✓ 6–8. a PRIVATE object has no public URL, and its signed URL works
✓ 9–12. moves public → private, leaving exactly one copy
✓ 10.  moves private → public, and the image becomes fetchable
✓ 13.  persists a metadata change without touching the object
✓ 14.  REFUSES to delete an image a campaign gallery references
✓ 15–16. deletes an unreferenced image from both the database and R2
Tests  9 passed (9)
```

Run three consecutive times, 9/9 each time. Teardown verified afterwards:
`sailent-public` 0 objects left behind, `sailent-private` 0 objects left
behind, `media` rows back to the seeded baseline of 15.

### The browser suite does not upload, on purpose

`playwright.config.ts` blanks the four R2 variables in the environment it hands
both servers, for the same reason it pins `DATABASE_URL` to the E2E database.
Playwright merges `webServer.env` into the parent environment and the API reads
the repo-root `.env`, so without that fence every E2E run would write test
images into `sailent-public` — the bucket the live site serves from — with
nothing to remove them.

R2 has no local emulator, so the fence blanks rather than redirects.
`StorageService.isConfigured` is then false and an upload is refused with a 503
naming the cause, which `admin-media.spec.ts` asserts as the real deployment
state it is.

`e2e/admin-media.spec.ts › uploads an image and shows it in the library`
therefore stays skipped. Not because anything is missing — the round-trip above
proves the upload path works against the live service — but because unfencing
the browser suite is the one thing that fence exists to prevent.

---

## F. API, admin and permissions

| Method | Path | Permission | Sensitive |
|---|---|---|---|
| GET | `/admin/media` | `media.read` | no |
| GET | `/admin/media/:id` | `media.read` | no |
| POST | `/admin/media` | `media.create` | no |
| PATCH | `/admin/media/:id` | `media.update` | no |
| DELETE | `/admin/media/:id` | `media.delete` | **yes** |

Delete is `@Sensitive()` because it is irreversible. Upload is not: an
administrator adding a dozen images is doing ordinary work, and a password
prompt on each would teach them to keep the sensitive window permanently open.

Admin routes: `/admin/media` and `/admin/media/[id]`.

Permissions `media.read/create/update/delete` added to the catalogue and seeded
to the local and E2E databases. **Production has not been seeded.**

Editable: `altText`, `caption`, `visibility`. Everything describing the stored
object — `storageKey`, `mimeType`, `sizeBytes`, `width`, `height`, `uploadedBy`,
timestamps — is refused by `.strict()`, because letting somebody retype them
would let the row disagree with the object it names.

---

## G. Success Stories integration

The story editor gained a picker of recent **public** images beside the existing
cover-image field. `success_stories.cover_image` is still a text column holding a
URL — no schema change, no second upload implementation, and uploading happens
in exactly one place. Private images are not offered: their URL is null by
constraint, so one would render as a broken image for every visitor.

---

## H. Tests

| Suite | Count | Storage |
|---|---|---|
| `image-inspection.spec.ts` | 14 | none — real bytes |
| `media.spec.ts` | 25 | substituted |
| `r2-round-trip.spec.ts` | 9 | **real R2, real buckets** |
| `admin-media.spec.ts` (e2e) | 5 + 1 skipped | fenced off — see §E |

In the unit suites object storage is substituted the same way `RazorpayClient`
is, and for the same reason: the alternative is a suite that cannot run without
credentials, a network and a bucket — which means a suite that does not run.
**What is not faked** is where the bugs live: `inspectImage` reads real bytes,
every rule about keys, references, visibility and permissions runs against the
real service, and `r2-round-trip.spec.ts` puts the whole path against real R2.

> The fake initially keyed objects by key alone, so the copy-then-delete move
> deleted what it had just written. The tests caught it. A fake that models the
> wrong thing proves the wrong thing — it now keys by bucket **and** key,
> because R2 buckets are separate namespaces.

### Results

`prettier` clean · `typecheck` 13/13 · `lint` 13/13 · `pnpm test` API **565
passed** (3 consecutive clean runs) · `test:e2e` **493 passed**, 47 skipped, 0
failed (3 consecutive clean runs) · `build` ✓ 8/8 tasks, 56/56 pages.

### Three flaky tests were fixed rather than retried

All three had the same shape — a **setup step failing quietly**, so the
assertion that reported the failure was not the one that was wrong. None was
fixed by raising a timeout.

1. **`volunteers.spec.ts`** — the phone-number helper was
   `800000000 + seed + (Date.now() % 100000)`. That modulo wraps every 100
   seconds, dropping the number by 100,000 while the seed had advanced by a few
   dozen, so about a hundred seconds in the generator reissued numbers it had
   already used. Run alone the suite finishes in ~15s and never reaches the
   wrap; under a full parallel run it does. A simulation over 5,000 runs puts
   the collision rate at 0% when fast and 1.1% when slow — matching a measured
   ~1-in-12. Replaced with a random per-run prefix and a monotonic counter: 0%.

2. **`e2e/dashboard.spec.ts`** — asserted on the panel immediately after
   cancelling a registration. `submitAndWait` waits for the POST to answer, but
   the panel is re-rendered by `router.refresh()`, a second round trip it does
   not wait for. Now reloads first, as `admin-stories.spec.ts` already did.

3. **`e2e/admin-stories.spec.ts`** — reloaded the page straight after clicking
   Save. `click()` resolves when the click is *dispatched*, and a reload
   cancels requests still in flight, so under load the edit was sometimes
   discarded before reaching the server. Now waits for the save to answer.

### Building the web app needs the API running

`generateStaticParams` for `/impact/[slug]` and `/stories/[slug]` calls the API
at build time. Build with nothing on `:4000` and those routes are emitted with
no paths and **500 at runtime** — which surfaced here as nine E2E failures that
had nothing to do with the tests. Start the API, then build.

---

## I. Production deployment

Nothing has been applied to production. When ready:

```bash
pnpm --filter @sailent/database db:seed --target=production \
  --confirm-host=<host> --reference
```

Plus `R2_*` in the production environment — the config **refuses to boot**
without them when `APP_ENV=production`, which is deliberate.

Note what `--reference` also does: it deletes and re-inserts every SUPER_ADMIN
grant, and upserts category names and slugs. See `phase-8.md` §16.4.

---

## J. Known limitations

1. **No thumbnails.** Full images are served into a grid. Acceptable at this
   size; a transformation step is a later decision.

2. **The browser suite cannot exercise a real upload** (§E). Deliberate, and
   the cost of having no R2 emulator; the API round-trip covers that path
   instead.
4. **No `deleted_at`** — deletion is hard, mitigated by the reference check.
5. **Reference checking covers `campaign_gallery` plus cover-image columns on
   stories, campaigns and programmes.** Anything embedding a URL inside a rich
   text body is not detected.
6. **`media.url` is denormalised.** Changing `R2_PUBLIC_BASE_URL` later would
   strand stored URLs; they would need rewriting.
