# Campaign and programme status transitions

The lifecycle rules, where they live, and why each refusal exists.

---

## 1. One table, two readers

The transition tables are in `packages/validation/src/domain/lifecycle.ts`, shared by the API that enforces them and the admin UI that decides which buttons to draw.

That sharing is the point. A UI with its own copy offers a button the server then refuses, and the operator learns the rule by hitting an error. The server remains the enforcement point regardless — `GET /admin/campaigns/transitions` returns the table so the client can be helpful, never so it can be trusted.

---

## 2. Campaign lifecycle

```
                 ┌──────────┐
                 │  draft   │◄──────────────┐
                 └────┬─────┘               │
                      │ publish             │
                 ┌────▼─────┐               │
        ┌────────┤ published├──────┐        │
        │        └────┬─────┘      │        │
        │             │ activate   │        │
        │        ┌────▼─────┐      │        │
        │   ┌───►│  active  │──┐   │        │
        │   │    └────┬─────┘  │   │        │
        │   │ resume  │ pause  │   │        │
        │   │    ┌────▼─────┐  │   │        │
        │   └────┤  paused  │  │   │        │
        │        └────┬─────┘  │   │        │
        │             │        │ complete   │
        │             └────────┼───┘        │
        │                 ┌────▼─────┐      │
        │                 │completed │      │
        │                 └────┬─────┘      │
        │      archive         │ archive    │ restore
        └──────────────────┬───┴────────────┘
                      ┌────▼─────┐
                      │ archived │
                      └──────────┘
```

| From | May become |
|---|---|
| `draft` | `published`, `archived` |
| `published` | `draft`, `active`, `archived` |
| `active` | `paused`, `completed`, `archived` |
| `paused` | `active`, `completed`, `archived` |
| `completed` | `archived` |
| `archived` | `draft` |

### The refusals that matter

**`draft → active` is refused.** Publishing and opening for donations are two decisions. Collapsing them means the moment a campaign becomes visible is also the moment it can take money, with no opportunity to read it back first.

**`completed → active` is refused.** Reopening a finished campaign means accepting money for work already reported as done — and every donor who gave to the completed version was told it was finished.

**`archived → published` is refused.** An archived campaign returns as a `draft`, gets reviewed, and is republished deliberately. Restoring straight to public means whatever caused it to be archived goes back up with it.

**Every self-transition is refused.** `active → active` is a no-op that usually means the client sent the wrong thing, and answering 200 hides that.

**`paused → completed` is allowed.** A campaign paused for review is often exactly the one that then gets wound up, and routing that through `active` would mean briefly reopening donations in order to close them.

---

## 3. Programme lifecycle

| From | May become |
|---|---|
| `draft` | `published`, `archived` |
| `published` | `draft`, `archived` |
| `archived` | `draft` |

`published → draft` — unpublishing — is how a programme that went out with a mistake comes off the site quickly. Forcing an operator to archive it instead would lose the distinction between "taken down to fix" and "no longer running".

---

## 4. What the public can see

```ts
PUBLIC_CAMPAIGN_STATUSES = ['published', 'active', 'paused', 'completed']
```

| Status | Listed | Reachable by URL | Takes donations |
|---|---|---|---|
| `draft` | — | — | — |
| `published` | ✅ | ✅ | — |
| `active` | ✅ | ✅ | ✅ |
| `paused` | ✅ | ✅ | — |
| `completed` | `?status=completed` or `all` | ✅ | — |
| `archived` | — | — | — |

**`paused` stays reachable.** It was public a moment ago. Pulling the page from under everyone holding the link — including printed material, QR codes and anyone mid-decision — is worse than showing it with donations closed and an explanation.

**`completed` stays reachable.** An NGO's credibility is mostly its history. A campaign that vanishes when it finishes takes the evidence with it.

**`draft` and `archived` are 404.** Not "hidden", not "403" — indistinguishable from never having existed. There is no query parameter that changes this, and the public query schema does not accept those values, so one cannot be smuggled past the filter.

---

## 5. Only `active` takes money

```ts
export function acceptsDonations(status: CampaignStatus): boolean {
  return status === 'active';
}
```

A `published` campaign has not opened. A `paused` one has been stopped deliberately. A `completed` one is finished. Taking a donation in any of those states means accepting money the organisation has not agreed to accept yet, has asked to stop accepting, or can no longer spend as described — and each is a refund conversation nobody wants to have.

`donationAvailability(status)` returns the state **and the sentence to show**, so the page never has to work the lifecycle out for itself and cannot word it differently from the API.

---

## 6. Reasons and the audit trail

Pausing and completing **require a reason**. Both are questions an operator will be asked about later — "why did this stop?" is the first thing anyone asks — and the answer belongs next to the event, not in somebody's memory.

Every transition writes an audit row:

```
actor · action · entity · old status · new status · reason · IP · user agent · timestamp
```

Archiving is recorded as `critical`; everything else as `warning`. Example:

```
warning  campaign.paused  campaign  {status: active} → {status: paused}
         reason: "Operations temporarily paused."
```

---

## 7. What must be true before publishing

Checked at the transition, not on every save — a half-written draft must still be saveable, which is the entire purpose of a draft.

**Programme:** a title, and a short description.

**Campaign:** a short description, a fundraising goal above zero, and an attached programme.

The programme requirement comes from decision A5: a campaign funds a specific piece of a programme. One without a programme cannot be attributed, reported on or rolled up.

A refusal names every missing field at once, so the operator fixes them in one pass:

```json
{ "code": "VALIDATION_FAILED", "details": [
  { "field": "fundraisingGoal", "message": "Set a fundraising goal above zero before publishing." },
  { "field": "programId", "message": "Attach this campaign to a programme before publishing." }
] }
```

A draft **may** have a goal of zero — the database check is `status = 'draft' OR fundraising_goal > 0`, so the rule that matters (nothing public without a real goal) is enforced in two places while a draft stays free to be incomplete.

---

## 8. Endpoints

| Action | Endpoint | Permission | Sensitive |
|---|---|---|---|
| Publish | `POST /admin/campaigns/:id/publish` | `campaign.publish` | |
| Open for donations | `POST /admin/campaigns/:id/activate` | `campaign.activate` | |
| Pause | `POST /admin/campaigns/:id/pause` | `campaign.pause` | |
| Complete | `POST /admin/campaigns/:id/complete` | `campaign.complete` | |
| Archive | `POST /admin/campaigns/:id/archive` | `campaign.archive` | ✅ |
| Any of the above | `POST /admin/campaigns/:id/status` | `campaign.publish` | |
| Read the table | `GET /admin/campaigns/transitions` | `campaign.read` | |

Publishing is deliberately **not** sensitive. It is the routine act of this phase, done many times a week, and a password prompt on every one would train operators to keep a re-auth window permanently open — which defeats the control everywhere it does matter.

An invalid transition returns **409 `CONFLICT`**, naming both states: `A campaign cannot go from completed to active.`
