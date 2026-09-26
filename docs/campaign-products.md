# Campaign products

Product-based giving: "a school kit for ₹900" rather than "₹900".

Phase 4 builds the **management foundation**. No checkout, no payment, no donation processing — those are Phase 5.

---

## 1. Why products exist

A donor deciding between "₹900" and "a school kit — notebooks, stationery, a bag and two uniforms for one child for a year" is deciding between an amount and an outcome. The second converts better and, more importantly, is a promise the organisation can be held to.

A campaign may offer several, and a donor may combine them with a free-text amount in one gift (decision A5).

---

## 2. Fields

| Field | Notes |
|---|---|
| `name`, `slug` | Slug unique **within the campaign** — see §4. |
| `description` | What the donor is funding, concretely. Required. |
| `price` | **Paise**, above zero. A CHECK enforces it. |
| `image` | Optional. |
| `targetQuantity` | How many are needed. Null means open-ended. |
| `fulfilledQuantity` | **System-controlled.** See §5. |
| `maxPerDonation` | Per-gift ceiling. Default 999. |
| `sortOrder`, `isActive`, `status`, `sku` | Display and availability. |

---

## 3. Price changes never rewrite history

`donation_items.unit_price` snapshots what was actually charged, at the moment it was charged (decision A5). Changing `price` here changes what the **next** donor is asked for and nothing else.

```
Product price today          ≠   Historical donation unit price
campaign_products.price          donation_items.unit_price
```

A receipt issued last month keeps saying what that donor paid. The database enforces the arithmetic on each line:

```sql
CHECK (total_price = quantity * unit_price)
```

A price change writes its own audit row — `campaign_product.price_changed`, severity `warning` — separate from the general update, because it is the edit that changes what a donor is charged and should be findable without reading every product edit ever made.

---

## 4. Slugs are unique per campaign, not globally

Two campaigns may each offer a `school-kit`. Forcing globally unique product slugs would rename the second to `school-kit-2` for no reason a donor could understand.

A duplicate within one campaign is a 409.

---

## 5. `fulfilledQuantity` is not editable on the form

It is meant to be a **consequence of donations**. It starts at zero, is absent from the create and update schemas, and a payload carrying it is stripped before the handler runs.

There are real cases for correcting it — a distribution that happened offline, a reconciliation after a refund — so there is a path, deliberately made narrow:

```
POST /admin/campaigns/:campaignId/products/:productId/fulfilment
{ "fulfilledQuantity": 12, "reason": "Offline distribution reconciled" }
```

- Its own permission, `campaign_product.adjust_fulfilment`, held by nobody below Admin.
- `@Sensitive()` — re-authentication within the last five minutes.
- A **mandatory reason**.
- Audited at severity `critical`.

An exception that can be made from the ordinary edit form stops being an exception. Putting it on its own endpoint means every adjustment is a decision somebody made on purpose and can be asked about.

---

## 6. Validation

| Rule | Enforced |
|---|---|
| `price > 0`, integer paise | Zod **and** a CHECK constraint |
| `targetQuantity >= 0`, integer | Zod |
| `targetQuantity` not below `fulfilledQuantity` | Service |
| `fulfilledQuantity >= 0` | Zod on the correction path, and a CHECK |
| `maxPerDonation > 0` | Zod and a CHECK |
| Unique slug within the campaign | Service, returning 409 |
| Campaign must exist | `assertCampaign` on every method |

That last one is the authorization boundary for child records: without it, someone with permission over their own campaign could edit another campaign's products by passing a different id.

---

## 7. Progress

The same shared calculation as campaign money, applied to units:

```ts
quantityProgress(target, fulfilled) → { target, fulfilled, remaining, percent, rawPercent, targetReached }
```

`percent` is capped at 100 for the bar; `rawPercent` reports over-fulfilment honestly. A null target is open-ended and renders as a count with no bar.

```
School Kit    ₹900
Provided      320 / 500     64%
```

---

## 8. Availability

| State | Public display |
|---|---|
| `isActive: true` | Available |
| `isActive: false` | Withheld from the public list |
| Target reached | Shown as fulfilled — **never** as "purchased" |

The public product list filters to active. Deactivating and reactivating are separately permissioned, audited, and refuse a no-op.

**Nothing claims a product has been bought.** `fulfilledQuantity` moves only on a real captured donation, which does not exist yet — so every seeded product reads `0 / 500`, which is true.

---

## 9. The donate control in this phase

Product cards and the quantity stepper from Phase 2 remain. The Donate button now understands campaign status (see [`campaign-status-transitions.md`](campaign-status-transitions.md) §5) and routes to the existing donation UI.

**No payment is processed, and no donation record is created.** The page says so.

---

## 10. Endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/campaigns/:slug` (embedded), `/campaigns/:campaignId/products` | — public, active only |
| GET | `/admin/campaigns/:campaignId/products` | `campaign_product.read` |
| POST | `/admin/campaigns/:campaignId/products` | `campaign_product.create` |
| PATCH | `/admin/campaigns/:campaignId/products/:productId` | `campaign_product.update` |
| POST | `…/activate` | `campaign_product.activate` |
| POST | `…/deactivate` | `campaign_product.deactivate` |
| POST | `…/fulfilment` | `campaign_product.adjust_fulfilment` (sensitive) |

---

## 11. Phase 5 will need

`fulfilled_quantity` incremented **in SQL under a row lock**, inside the transaction that records the captured payment:

```sql
BEGIN;
SELECT fulfilled_quantity FROM campaign_products WHERE id = $1 FOR UPDATE;
UPDATE campaign_products SET fulfilled_quantity = fulfilled_quantity + $2 WHERE id = $1;
COMMIT;
```

Read-modify-write in application code loses concurrent donations, and the ones it loses are real money. It also needs the "last unit" race resolved: two donors buying the final kit simultaneously — the row lock is what makes that decidable.
