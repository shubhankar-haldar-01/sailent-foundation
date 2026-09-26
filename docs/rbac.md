# RBAC — Roles, Permissions and Sensitive Operations

**Phase:** 0 · **Date:** 19 September 2026

Permission-string based, deny-by-default (decision A9). Guards check
**permissions**, never role names, so adding a role is configuration rather
than a code audit.

> ## ⚠️ SECTION 2 IS SUPERSEDED
>
> **Phase 8 collapsed the staff roles into one: `SUPER_ADMIN`.** The six roles
> described below were designed in Phase 0, seeded in Phase 3, and retired in
> Phase 8. The application's three user types are now `SUPER_ADMIN`, `DONOR`
> and `VOLUNTEER`, and the last two are not roles — they are rows in `donors`
> and `volunteers`, authenticated into a different token audience.
>
> Section 2 is kept, unedited, because **the separation-of-duties reasoning in
> it is the argument to make again** if a second staff role is ever wanted:
> why finance was kept away from content, why a campaign manager could see
> totals but not donors, why the content role had the smallest blast radius.
> That thinking survives its roles. Read it as a design rationale, not as a
> description of the running system.
>
> The model (§1), the permission catalogue (§3) and the sensitive-operations
> list (§4) are all still current. See
> [`phase-8.md`](phase-8.md) §2 and [`rbac-implementation.md`](rbac-implementation.md) §7.

---

## 1. Model

```
User ──< user_roles >── Role ──< role_permissions >── Permission
```

- A user may hold **multiple roles**; effective permissions are the **union**.
- Permissions are `resource.action` strings.
- **Deny by default.** A route with neither `@Public()` nor a permission requirement is unreachable by anyone.
- Roles are database rows editable by a Super Admin. System roles cannot be deleted.
- Permissions marked `is_sensitive` additionally require re-authentication within the last 5 minutes.

### Why not check roles directly

`if (user.role === 'admin')` scattered through guards means every new role requires auditing every guard, and it inevitably drifts — some check `admin`, some check `admin || super_admin`, one forgets. Permission strings put the policy in one table that can be read, exported and reviewed in full.

---

## 2. Roles

### Super Admin
**The only role that can change what other roles can do.** Full access including user management, role editing, settings and audit logs. Intended for one or two people.

*Constraint: the system always retains at least one active Super Admin. Removing the last one is blocked at the database level, not just in the UI.*
*Requires TOTP 2FA.*

### Admin
Day-to-day operational control across all modules. Cannot edit roles or permissions, cannot delete audit logs (nobody can), and cannot manage Super Admin accounts.

*Requires TOTP 2FA.*

### Finance Manager
Owns money. Donations, payments, receipts, reconciliation, settlements, financial reporting, and the **Form 10BD / 10BE compliance cycle** with its 31 May deadline.

Can view donor records including tax IDs, because the 10BD statement requires them. Cannot publish content, cannot manage volunteers, cannot create campaigns.

*Requires TOTP 2FA — this role can move money out.*

### Campaign Manager
Creates and runs campaigns, campaign products, updates and impact records. Can **view** donation totals and donor counts for their campaigns, because running a campaign without seeing whether it is working is impossible.

**Cannot see individual donor PII.** The aggregate is enough to do the job; the identities are not needed.

### Volunteer Manager
Owns the volunteer lifecycle: applications, approval, assignments, attendance, hours, certificates, and volunteer documents. Manages events and event registrations.

Can see volunteer PII including documents, since verification requires it. No access to donations, payments or finance.

### Content Manager
Pages, blog, stories, FAQs, gallery, media, and public documents. Can compose the homepage from approved sections and publish content.

No access to donations, donors, volunteers or finance. This is the role most likely to be held by an external contributor, so its blast radius is deliberately small.

### Viewer *(recommended addition)*
Read-only across dashboards and reports with **no PII and no financial detail**. Not in the original list, but repeatedly needed in practice: trustees, auditors during a review, prospective funders being shown the system, and a new joiner in their first week. Without it, people get given Admin.

---

## 3. Permission catalogue

`✅` granted · `◐` limited (scope noted) · `—` denied

### Campaigns

| Permission | Super | Admin | Finance | Campaign | Volunteer | Content | Viewer |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `campaign.view` | ✅ | ✅ | ✅ | ✅ | — | ◐ published | ✅ |
| `campaign.create` | ✅ | ✅ | — | ✅ | — | — | — |
| `campaign.edit` | ✅ | ✅ | — | ✅ | — | — | — |
| `campaign.publish` | ✅ | ✅ | — | ✅ | — | — | — |
| `campaign.pause` | ✅ | ✅ | — | ✅ | — | — | — |
| `campaign.delete` 🔒 | ✅ | ✅ | — | — | — | — | — |
| `campaign.product.manage` | ✅ | ✅ | — | ✅ | — | — | — |
| `campaign.update.publish` | ✅ | ✅ | — | ✅ | — | ✅ | — |

### Donations and payments

| Permission | Super | Admin | Finance | Campaign | Volunteer | Content | Viewer |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `donation.view` | ✅ | ✅ | ✅ | ◐ aggregates only | — | — | ◐ aggregates |
| `donation.view_pii` 🔒 | ✅ | ✅ | ✅ | — | — | — | — |
| `donation.export` 🔒 | ✅ | ✅ | ✅ | — | — | — | — |
| `payment.view` | ✅ | ✅ | ✅ | — | — | — | — |
| `payment.manage` 🔒 | ✅ | — | ✅ | — | — | — | — |
| `subscription.view` | ✅ | ✅ | ✅ | ◐ aggregates | — | — | — |
| `subscription.manage` 🔒 | ✅ | — | ✅ | — | — | — | — |

**`donation.refund` no longer exists.** Phase 7 withdrew refunds entirely — the permission, the table and the route went together (migration `0010`). It was previously denied to Admin as a separation-of-duties measure; there is now nothing to deny.

### Receipts and tax compliance

| Permission | Super | Admin | Finance | Others |
|---|:--:|:--:|:--:|:--:|
| `receipt.view` | ✅ | ✅ | ✅ | — |
| `receipt.manage` 🔒 (void, reissue) | ✅ | — | ✅ | — |
| `tax.view` | ✅ | ✅ | ✅ | — |
| `tax.export` 🔒 (Form 10BD) | ✅ | — | ✅ | — |
| `tax.manage` 🔒 (10BE upload) | ✅ | — | ✅ | — |

### Donors

| Permission | Super | Admin | Finance | Campaign | Others |
|---|:--:|:--:|:--:|:--:|:--:|
| `donor.view` | ✅ | ✅ | ✅ | ◐ counts only | — |
| `donor.view_sensitive` 🔒 (PAN, address) | ✅ | ✅ | ✅ | — | — |
| `donor.edit` | ✅ | ✅ | ✅ | — | — |
| `donor.export` 🔒 | ✅ | ✅ | ✅ | — | — |
| `donor.delete` 🔒 | ✅ | — | — | — | — |

### Volunteers

| Permission | Super | Admin | Volunteer Mgr | Others |
|---|:--:|:--:|:--:|:--:|
| `volunteer.view` | ✅ | ✅ | ✅ | — |
| `volunteer.view_documents` 🔒 | ✅ | ✅ | ✅ | — |
| `volunteer.edit` | ✅ | ✅ | ✅ | — |
| `volunteer.approve` 🔒 | ✅ | ✅ | ✅ | — |
| `volunteer.suspend` 🔒 | ✅ | ✅ | ✅ | — |
| `volunteer.assign` | ✅ | ✅ | ✅ | — |
| `volunteer.attendance` | ✅ | ✅ | ✅ | — |
| `volunteer.certificate` | ✅ | ✅ | ✅ | — |
| `volunteer.export` 🔒 | ✅ | ✅ | ✅ | — |

### Events, programmes, impact, stories

| Permission | Super | Admin | Campaign | Volunteer Mgr | Content | Viewer |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `event.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `event.manage` | ✅ | ✅ | ✅ | ✅ | — | — |
| `event.registration.view` 🔒 | ✅ | ✅ | — | ✅ | — | — |
| `event.attendance` | ✅ | ✅ | — | ✅ | — | — |
| `program.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `program.manage` | ✅ | ✅ | ✅ | — | — | — |
| `impact.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `impact.create` / `impact.publish` | ✅ | ✅ | ✅ | — | ✅ | — |
| `story.create` / `story.edit` | ✅ | ✅ | ✅ | — | ✅ | — |
| `story.publish` 🔒 | ✅ | ✅ | — | — | ✅ | — |

**`story.publish` is sensitive** because publishing a beneficiary's name, photograph and circumstances is irreversible in practice. The schema blocks publishing without recorded consent (`database-architecture.md` §10); the permission adds a human gate on top.

### Content and documents

| Permission | Super | Admin | Content | Others |
|---|:--:|:--:|:--:|:--:|
| `content.view` | ✅ | ✅ | ✅ | ◐ |
| `content.create` / `content.edit` | ✅ | ✅ | ✅ | — |
| `content.publish` | ✅ | ✅ | ✅ | — |
| `content.delete` 🔒 | ✅ | ✅ | — | — |
| `page.compose` (homepage sections) | ✅ | ✅ | ✅ | — |
| `media.upload` / `media.manage` | ✅ | ✅ | ✅ | — |
| `document.view_private` 🔒 | ✅ | ✅ | — | — |
| `document.manage` | ✅ | ✅ | ◐ public only | — |
| `document.change_visibility` 🔒 | ✅ | ✅ | — | — |

### System

| Permission | Super | Admin | Others |
|---|:--:|:--:|:--:|
| `user.view` | ✅ | ✅ | — |
| `user.invite` 🔒 | ✅ | ✅ | — |
| `user.suspend` 🔒 | ✅ | ✅ | — |
| `user.assign_role` 🔒 | ✅ | — | — |
| `role.view` | ✅ | ✅ | — |
| `role.manage` 🔒 | ✅ | — | — |
| `settings.view` | ✅ | ✅ | — |
| `settings.manage` 🔒 | ✅ | — | — |
| `audit.view` | ✅ | ✅ | — |
| `audit.export` 🔒 | ✅ | — | — |
| `report.view` | ✅ | ✅ | ◐ by module | ✅ Viewer |
| `report.export` 🔒 | ✅ | ✅ | ◐ | — |
| `notification.send` 🔒 | ✅ | ✅ | ◐ Content | — |

---

## 4. Sensitive operations 🔒

Operations marked 🔒 require **all** of:

1. The permission.
2. **Re-authentication within the last 5 minutes** — password + TOTP for staff.
3. An audit row with a before/after diff.
4. For destructive operations, a typed confirmation naming the record.

The full list: any export containing PII · voiding or reissuing a receipt · the Form 10BD export · role assignment and role editing · user suspension · volunteer approval, rejection and suspension · changing a document's visibility · publishing a story · deleting anything · replaying a webhook · changing settings.

### Separation of duties

| Operation | Rule |
|---|---|
| _(Refunds, formerly listed here, were withdrawn in Phase 7 — see `phase-7.md`.)_ | |
| Role assignment | A user cannot grant themselves a permission they do not hold |
| Super Admin removal | Blocked if it would leave zero active Super Admins |
| Own account | A user cannot suspend or delete their own account, or change their own roles |
| Audit log | No user of any role can modify or delete it (A10) |

---

## 5. Enforcement

**API (authoritative).** Guard chain per `api-architecture.md` §5: authentication → audience → permission → re-authentication → audit interceptor. The audit interceptor is wired to the same decorator as the permission guard, so a permission-gated mutation cannot ship without its audit trail.

**Admin UI (cosmetic).** The sidebar and action buttons filter from `GET /auth/me`'s permission list, so a user never sees a menu item leading to a 403. **This is a usability feature, not a security control.** Every filtered action is independently enforced server-side; a user who hand-crafts the request still fails at the guard.

**Permission resolution** happens per request, not at login. A role change takes effect on the next call. Privilege *reduction* additionally invalidates the user's sessions, so removing someone's access is immediate rather than pending their next login.

---

## 6. Default assignments at launch

| Person | Role(s) |
|---|---|
| Founder / Director | Super Admin |
| Operations lead | Admin |
| Accountant / CA liaison | Finance Manager |
| Programme leads | Campaign Manager |
| Volunteer coordinator | Volunteer Manager |
| Communications | Content Manager |
| Trustees, auditors | Viewer |

Principle of least privilege: start narrow and widen on demonstrated need. Widening is a two-minute change with an audit trail; recovering from a leaked donor export is not.

---

*Related: [`api-architecture.md`](api-architecture.md) · [`security-architecture.md`](security-architecture.md) · [`database-architecture.md`](database-architecture.md)*
