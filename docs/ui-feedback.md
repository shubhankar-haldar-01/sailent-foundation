# UI feedback and states

How the site tells people what is happening: loading, success, errors, empty lists, confirmations, validation and payments. **One pattern per situation, everywhere.** When a case does not fit a rule below, ask the owner rather than inventing a new pattern.

Status: rules approved by the owner on 2026-11-19 (Phase 0 audit and its recommendations). The building blocks exist (Phase 1); the payment flow follows §3 (Phase 3); the admin, public and donor screens were moved onto them in Phase 4, and Phase 5 checked the whole system against the brief's quality bar (both 2026-11-20). What was left as it was, and why, is in `DEVELOPMENT_STATUS.md`.

Permanent rules that follow from this document are in `AGENTS.md` §11 items 18 and 19. The visual system (colours, type, buttons) is in `docs/design-system.md`.

---

## 1. The building blocks

| Block | Import | Use it for |
|---|---|---|
| `toast` | `@sailent/ui` | A quick action finished, or failed outside a form |
| `Button isLoading loadingText` | `@sailent/ui` | Any button whose action takes time |
| `Spinner` | `@sailent/ui` | Inside a button or a small area. Never for a page or a section's first load |
| `Skeleton`, `SkeletonText`, `SkeletonAvatar`, `SkeletonCard`, `SkeletonTableRow` | `@sailent/ui` | A page or section loading for the first time |
| `TopProgressBar`, `startProgress()`, `doneProgress()` | `@/components/feedback/top-progress-bar` | Navigation, and a slow refresh while old data stays on screen |
| `EmptyState` (`kind`: `no-content`, `no-results`, `no-access`) | `@sailent/ui` | A list or area with nothing in it |
| `ErrorState` | `@sailent/ui` | A section that failed to load (Retry, optional reference id) |
| `ErrorBoundary` | `@sailent/ui` | Wrap a section so a crash stays inside it |
| `Banner` | `@sailent/ui` | A condition that lasts (offline, maintenance, paused, PAN missing) |
| `OfflineBanner` | `@sailent/ui` | Mounted once for the whole app |
| `ConfirmationDialog` | `@sailent/ui` | A destructive or irreversible action |
| `FieldError`, `fieldErrorProps` | `@sailent/ui` | A field's own error, linked for screen readers |
| `FormStatus` (`success`) | `@/components/admin/form-shell` | An admin form's outcome: a success toast named by `success` ("Campaign saved"; `null` when the form shows its own), and the error banner |
| `SubmitButton` (`pendingText`) | `@/components/admin/form-shell` | An admin form's submit: `Button isLoading`, "Saving…" unless told otherwise |
| `AdminListEmpty`, `isFiltered` | `@/components/admin/list-empty` | An admin list with nothing to show: "No campaigns match" + Clear filters, or "No campaigns yet" |
| `MaintenanceBanner` | `@/components/feedback/maintenance-banner` | Mounted once; shows `NEXT_PUBLIC_MAINTENANCE_MESSAGE` when set |
| `CampaignClosedCard` | `@/components/donations/campaign-closed-card` | In place of the donation card when a campaign has ended or is paused |
| `StatusBadge` | `@sailent/ui` | Campaign, donation and volunteer statuses |
| `CampaignProgress`, `Progress` | `@sailent/ui` | Raised vs goal; upload progress |
| `useAsyncAction` | `@/lib/feedback/use-async-action` | Run an action: loading, then a success or error toast with Try again |
| `useRevealResult` | `@/lib/ui/reveal-result` | Bring a form's result into view and focus it |
| `useUnsavedChangesGuard`, `useEditorGuard` | `@/lib/feedback/use-unsaved-changes-guard` | Warn before leaving unsaved edits; `useEditorGuard(state)` for a form whose fields are its own (the campaign, event, blog and story editors) |
| `friendlyError`, `errorText` | `@/lib/feedback/error-messages` | Turn any failure into a title and what to do next; `errorText(error, fallback)` for one inline line (keeps the API's own words, never a raw error) |

All of them are live at `/dev/ui-states` (development only).

---

## 2. Which pattern, when

| Situation | Use | Do not use |
|---|---|---|
| A quick action finished: saved, published, copied, sent | **Success toast**, past tense: "Campaign saved" | A full-width "Saved." banner, `alert()` |
| A form saved, and the form stays on screen | **Success toast** naming what was saved (`FormStatus success="…"`, or `toast.success`) | A banner the person must scroll to find |
| A submission that **replaces** the form with a confirmation (message sent, application received, registration made) | The confirmation **in place of the form**, revealed and focused (`useRevealResult`) | A toast alone: it disappears, and the form is gone |
| A form submission is refused or fails on the server | **Inline error banner at the form**, revealed and focused (`FormStatus` / `useRevealResult`), with the specific message; field errors under their fields; **the entered values are kept** | Clearing the form; a toast as the only signal |
| An action outside a form fails (publish, retry, archive, upload, export) | **Error toast** with **Try again** when retrying could help (`useAsyncAction`) | A banner far from the button |
| An action the API can reverse **exactly** (pause ⇄ resume a campaign, remove a saved campaign) | **Undo toast** (`toast.undo`), 6 seconds | A confirmation dialog |
| An action that cannot be reversed exactly: delete; **archive** (an archived campaign can only come back as a draft, never straight to its old public state, `lifecycle.ts`) | **ConfirmationDialog**, `variant="destructive"`, the button names the action ("Archive campaign") | An Undo that would not restore what was there; a toast alone; "OK" / "Yes" buttons |
| A field is invalid | **FieldError** under the field, shown when the person leaves it; corrected live once they fix it; on submit, focus the first invalid field | A toast; "Invalid input" |
| A page or section loads for the first time | **Skeleton** shaped like the content (appears after 300 ms) | A full-page spinner |
| Data refreshes while the old data is shown | **Top progress bar** or a small `Spinner` beside the control; keep showing the old data | Swapping the content back to skeletons |
| A button's action is in progress | **`Button isLoading`**, set on the first click (no double submit) | A separate overlay; a button that empties into a spinner |
| Something slow the person waits for (an export) | **Loading toast** that becomes the outcome: "Preparing export…" → "Export ready" | A frozen page |
| A condition that lasts (offline, maintenance, campaign paused, PAN missing) | **Banner** | A toast: it disappears while the condition remains |
| A campaign not taking donations (ended, paused, past its end date) | **`CampaignClosedCard`** where the donation card would be: why, and **See open campaigns**; no amount chips, no Donate button | A disabled Donate button; a reason the record does not hold |
| A list has nothing in it | **EmptyState** with the next action ("Explore campaigns") | A blank area; "No data" on its own |
| Filters return nothing | **EmptyState `kind="no-results"`** with **Clear filters** | The "nothing yet" message, which reads as if the list were empty |
| A section fails to load | **ErrorState** with **Retry**, scoped to that section (`ErrorBoundary`) | Breaking the whole page |
| A whole route fails | The route's `error.tsx` / `not-found.tsx` (already in place) | A blank screen |
| Leaving a page with unsaved changes | **`useUnsavedChangesGuard`** (browser prompt on tab close; "Leave without saving?" on in-site links) | Losing the edits silently |
| **A payment's outcome** | **A page**: the donation status page and the success page | **A toast, ever**: a donor who misses it cannot get it back |

---

## 3. Payments

The donation flow must be trustworthy and impossible to double-charge. Built in Phase 3 (2026-11-19); the code is `components/donations/donation-checkout.tsx`, `donation-status.tsx`, `donation-success.tsx` and `lib/payments/`.

| Moment | What the donor sees | How |
|---|---|---|
| Before paying | Field errors when a field is left, corrected live; on Pay, focus on the first mistake; the summary card | `validateField`, `fieldErrorProps` |
| Pressing Pay | The button is busy from the first press; a second press does nothing; one donation per basket | `submitting` guard; `Idempotency-Key` per attempt |
| An earlier attempt in this tab (refresh, Back, a duplicated tab) | Paid or being confirmed: **straight to the result**, never a second payment. Still open: the **same order** reopens. Failed or cancelled: a fresh attempt | `checkout-session.ts` asks the server first (`verdictFor`) |
| Razorpay open | "Don't close or refresh this page until your payment is complete." | — |
| Razorpay returns | Full screen **"Confirming your payment…"** while the **server** verifies; then the status page | The browser's "paid" is never shown as success |
| Pending | "Confirming your payment" while the status page polls (backing off over about 90 s), then "This is taking longer than usual. **Please do not pay again.**" with the reference | `donation-status.tsx` |
| Back online | The status is asked again at once, even after the wait ran out | `online` listener |
| Failed | The reason, the **reference**, and the details kept for **Try again** | `stage.kind === 'error'` |
| Closed Razorpay | "**Payment cancelled.** Your donation wasn't made." Not an error; the details stay | `stage.kind === 'cancelled'` |
| Offline | The site-wide offline banner; Pay says so and sends nothing | `OfflineBanner`, `navigator.onLine` |
| Success | The success page; **Download receipt** shows "Preparing receipt…" then a toast either way; **Share** confirms with the "Copied" pill | `useAsyncAction`, `toast.copied` |

Never:
- **Refund wording.** There are no refunds in the platform and no published refund terms (`AGENTS.md` §10). Not "refunded in 5–7 days" or anything like it.
- **Tax claims.** A receipt is not an 80G certificate; the site says only that Form 10BE comes after the annual Form 10BD filing (§10). No PAN at checkout: PAN is added later, on the donor's profile.
- **A toast for a payment's outcome.**

---

## 4. Words

| Rule | Yes | No |
|---|---|---|
| Sentence case, 2–5 words, past tense for something done | "Campaign saved", "Link copied" | "Campaign Saved Successfully!" |
| No "successfully", no "!", no "Error:" prefix | "Couldn't save campaign" | "Error: Save failed!" |
| An error says what happened **and what to do next** | "Couldn't save campaign" · "We couldn't reach our server. Try again in a moment." | "Something went wrong." alone |
| Never a stack trace, a database message or a raw server failure | `friendlyError(error)` | `error.message` from a 5xx |
| The API's own refusal text may be shown: it is written for people | "That slug is already used by another campaign." | — |
| Name the action on buttons | "Delete campaign", "Leave page" | "OK", "Yes", "Submit" |
| Plain, specific, friendly; no blame | "Check your connection and try again." | "You entered an invalid value." |

`toast` warns in the development console when a title contains "successfully", "!" or "Error:".

---

## 5. Timing and placement

- **Toasts:** bottom right on desktop, bottom centre on a phone (16px margins). At most three, newest on top. Success and info 4 s, warning and undo 6 s, the "Copied" pill 2 s; **errors stay until closed**; a loading toast stays until updated. Hover or focus pauses; Esc or × closes.
- **Skeletons** appear only after 300 ms, so a quick load shows nothing rather than a flash. Every route has one: its own `loading.tsx`, or the root `app/loading.tsx` (a heading and paragraphs), never a full-page spinner.
- **Loading buttons keep their width exactly.** Give `Button isLoading` a `loadingText` no longer than the label ("Saving…" for "Save settings"), or keep the label and give the button an icon: while busy the spinner takes the icon's place. A label-only button with no `loadingText` grows by the spinner's width.
- **Top progress bar** appears after 150 ms and gives up after 10 s.
- **Motion** 150–250 ms, ease-out (`--duration-*`, `--ease-out-soft`); everything respects `prefers-reduced-motion`.
- **Layers:** content < sticky header (`--z-sticky`) < dropdowns and dialogs (`--z-overlay`) < offline banner and progress bar (`--z-banner`) < toasts (`--z-toast`).

---

## 6. Accessibility (WCAG 2.2 AA)

- Success and info toasts are `role="status"` (polite); errors are `role="alert"`. Toasts never take focus.
- A form's result is revealed **and focused** (`useRevealResult`, AGENTS.md §11 item 18), except sign-in forms, per-field errors and messages already beside the button.
- Field errors are linked with `aria-describedby` and set `aria-invalid` (`fieldErrorProps`).
- Dialogs keep focus inside, close with Esc, and return focus to what opened them (Radix).
- Colour is never the only signal: every status has an icon and words.
- Touch targets at least 44×44 px. A control drawn smaller (a toast's ×, a banner's dismiss, the amount chips, the steppers, a `size="sm"` button in a new pattern) gets the **`touch-target`** utility (`tokens.css`): an invisible 44×44 tap area centred on it, no change to how it looks. The control must be positioned (`relative`, or already `absolute`).
- Text contrast at least 4.5:1, with one known exception the owner chose: white on the brand orange `#EB6A1F` (about 3.2:1; `DEVELOPMENT_STATUS.md` §5.6).
- Visible focus states: every control shows its ring on keyboard focus (`focus-visible`).
- Reduced motion: spinners stop turning, the progress bar stands still, skeletons appear without pulsing, and a toast's countdown bar is hidden (toasts have no entrance animation at all).

---

## 7. Examples

```tsx
import { Button, toast } from '@sailent/ui';
import { useAsyncAction } from '@/lib/feedback/use-async-action';

// A quick action with a toast either way, and no double submit.
const publish = useAsyncAction(() => publishStory(id), { success: 'Story published' });
<Button isLoading={publish.pending} loadingText="Publishing…" onClick={() => publish.run()}>
  Publish
</Button>;

// Something slow: a loading toast that becomes the outcome.
const exportDonations = useAsyncAction(runExport, {
  loading: 'Preparing export…',
  success: 'Export ready',
});

// Reversible: undo instead of a dialog.
toast.undo('Campaign removed from saved', () => saveAgain(id));

// Copy.
await navigator.clipboard.writeText(url);
toast.copied('Link copied');
```

```tsx
// A form: field errors under fields; a refusal at the form, revealed; values kept.
<form action={action}>
  <FormStatus state={state} success="Campaign saved" />
  <Input id="title" name="title" defaultValue={values.title} {...fieldErrorProps('title', state.fieldErrors?.title)} />
  <FieldError fieldId="title" error={state.fieldErrors?.title} />
  <Button type="submit" isLoading={pending} loadingText="Saving…">Save campaign</Button>
</form>
```

```tsx
// A section that loads on its own, and fails on its own.
<ErrorBoundary title="Updates didn't load">
  <React.Suspense fallback={<SkeletonText lines={4} />}>
    <CampaignUpdates />
  </React.Suspense>
</ErrorBoundary>

// Nothing to show.
<EmptyState
  title="You haven't donated yet"
  description="When you give to a campaign, it appears here with its receipt."
  action={<Button asChild size="sm"><Link href="/campaigns">Explore campaigns</Link></Button>}
/>
```

```tsx
// Unsaved edits.
const guard = useUnsavedChangesGuard(isDirty);
return <form>{/* … */}{guard.dialog}</form>;

// An editor whose fields are its own: any edit marks it, a successful save clears it.
const guard = useEditorGuard(state);
return <form action={action} onChange={guard.markDirty}>{/* … */}{guard.dialog}</form>;
```

### Mounted once

- `AppProviders` (`apps/web/src/providers/index.tsx`): `OfflineBanner`, `TopProgressBar`, `MaintenanceBanner`, then `ToastProvider` around the page. Nothing to add per page.
- `TopProgressBar` starts on a click of a link to another page of the site, never for `/api/…` links (a download is not a page change).
- `app/admin/(workspace)/loading.tsx`: the admin page skeleton (header, filters, table) inside the workspace shell.
- `NEXT_PUBLIC_MAINTENANCE_MESSAGE` is fixed at build time; production would need it as a Docker build argument, which is not wired yet (`docs/environment.md`).

---

## 8. Not used on this platform

Decided by the owner (2026-11-19); do not add them without the owner:

- **Refunds:** no refund dialog, no "Refunded" status, no refund wording (§10).
- **Recurring donations:** one-time only (§10).
- **"Email again"** for receipts.
- **PAN at checkout** and an **"80G validity" banner** (no validity date is recorded).
- **A new toast library:** the kit's own `toast` is the one.

---

## 9. Checks

Each must find nothing outside tests (Phase 5 runs them):

```bash
grep -rnE "(^|[^a-zA-Z_.])(alert|confirm|prompt)\(|window\.(alert|confirm|prompt)\(" apps/web/src --include='*.tsx' --include='*.ts'   # browser dialogs
grep -rn "Loader2" apps/web/src --include='*.tsx'                                                    # use Spinner or Button isLoading
grep -rn "animate-spin" apps/web/src --include='*.tsx'                                               # likewise
```

All three found nothing on 2026-11-20 (Phase 4).
