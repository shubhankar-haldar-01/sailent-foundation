# RBAC implementation

How authorization is enforced in the running system.

The role and permission *design* is in [`rbac.md`](rbac.md); this document is the mechanism.

---

## 1. Permissions, never role names

Guards check permission strings. No guard anywhere contains a role name.

```ts
@RequirePermission('campaign.publish')
```

`if (user.role === 'admin')` scattered through guards means every new role requires auditing every guard, and it inevitably drifts — some check `admin`, some check `admin || super_admin`, one forgets. Permission strings put the policy in one table that can be read, exported and reviewed in full.

Roles are bundles of permissions stored as data. Adding a seventh role is configuration.

---

## 2. The chain

`AuthGuard` runs on every request, in this order. The order is the design.

```
1. @Public()            explicitly marked, and every marking is reviewed
2. Authenticated        valid, unexpired, correctly-signed token whose session is live
3. Audience             a donor token dies at a staff route HERE, before any permission lookup
4. Permission           DENY BY DEFAULT
5. Freshness            @Sensitive() needs a re-auth within five minutes
```

**Audience before permission.** A donor token is rejected at a staff route before the permission table is consulted at all. `auth.guard.spec.ts` asserts this by spying on `hasPermission` and requiring that it was never called.

**Freshness last.** Someone who lacks the permission outright is told that, rather than being sent to re-enter a password for something they still could not do.

### Deny by default

```ts
if (requiredAudience === 'staff' && requiredPermissions.length === 0 && !authenticatedOnly) {
  throw new ForbiddenException("You don't have access to this.");
}
```

A staff route with no declared permission is **unreachable by everyone**. Forgetting to protect a route produces a 403 for the whole organisation, not an open endpoint — the failure mode is a support ticket rather than a breach.

### The one exception, made explicit

Some routes genuinely need nothing beyond a valid session. `/auth/me` must answer for a staff member who holds no permissions at all, or the admin UI cannot even tell them they have none.

That is `@AuthenticatedOnly()` — a decorator whose entire purpose is to make the exception greppable and reviewable, the way `@Public()` is. Deny-by-default without an escape hatch would have made `/auth/me` return 403 to everybody, which is precisely what it did before this decorator existed.

---

## 3. Where permissions come from

Effective permissions are the **union across every role a user holds**:

```sql
SELECT DISTINCT p.key
FROM user_roles ur
JOIN role_permissions rp ON rp.role_id = ur.role_id
JOIN permissions p       ON p.id = rp.permission_id
WHERE ur.user_id = $1
```

Resolved at **login and at every refresh**, then carried in the access token so the guard does not query on every request. The cost of that choice is bounded by the 15-minute access-token life: a permission revoked now takes effect within fifteen minutes, or immediately if the session is revoked.

When a change must be immediate — suspension — the session is revoked directly, which kills the access token at once.

---

## 4. Sensitive operations

```ts
@RequirePermission('user.assign_role')
@Sensitive()
@Post('users/:id/roles')
```

`@Sensitive()` adds two requirements: a re-authentication within the last five minutes (see [`authentication.md`](authentication.md) §5), and an audit row — always, whatever the outcome.

Currently sensitive: inviting a staff member, assigning roles, suspending and reactivating an account. Later phases add donor exports, donor record corrections, document visibility changes and campaign deletion. (Refunds were on this list until Phase 7 withdrew them.)

The client distinguishes `REAUTH_REQUIRED` from `FORBIDDEN` and prompts for a password instead of hiding the control.

---

## 5. Separation of duties

Two rules are enforced in the **service**, not the guard, because a service is harder to route around than a decorator:

```ts
if (id === actor.id) {
  throw new ForbiddenException('You cannot change your own roles. …');
}
```

- **Nobody changes their own roles**, whatever permissions they hold. Self-elevation defeats every other control in the system.
- **Nobody suspends or reactivates their own account.**

Two exclusions are built into the role bundles themselves:

- **`donation.refund` no longer exists.** Phase 7 withdrew refunds entirely — the permission, the table and the route went together. It was previously denied to ADMIN as a separation-of-duties measure.
- **`donation.read_pii` was denied to CAMPAIGN_MANAGER** as a separation-of-duties measure: running a campaign requires knowing whether it is working, not who gave. Phase 8 retired that role (§7), so the split no longer exists — the reasoning is kept because it is the argument to make again if the roles ever come back.

The first is asserted in `test/database.spec.ts`, so a well-meaning edit to the seed fails CI.

---

## 6. Suspension revokes sessions

```ts
await tx.update(users).set({ status }).where(eq(users.id, id));

if (status !== 'active') {
  await tx.execute(sql`
    UPDATE sessions SET revoked_at = now(), revoked_reason = 'account_suspended'
    WHERE user_id = ${id} AND revoked_at IS NULL
  `);
}
```

In one transaction. An account that keeps working until its access token expires is not suspended, it is *scheduled* for suspension — and the fifteen minutes in between are exactly when it matters.

---

## 7. The catalogue

**There is exactly one staff role.** Phase 8 collapsed
`ADMIN`, `CAMPAIGN_MANAGER`, `FINANCE_MANAGER`, `CONTENT_MANAGER` and
`VOLUNTEER_MANAGER` into `SUPER_ADMIN`; see [`phase-8.md`](phase-8.md) §2 for
the migration, which moves every holder before deleting anything and refuses
to run if that would strand a user.

| Role | Permissions | Owns |
|---|---|---|
| SUPER_ADMIN | all | Everything, including role editing and the audit log |

The three **application** user types are `SUPER_ADMIN`, `DONOR` and
`VOLUNTEER`. The last two are not roles in this table and never appear in
`user_roles` — a donor and a volunteer are rows in `donors` and `volunteers`,
authenticated by OTP into a different token audience entirely.

Read the catalogue live rather than trusting a count written down:

```
GET /admin/permissions      → the full catalogue, grouped by resource
GET /admin/roles            → roles with permission and user counts
GET /admin/roles/:key       → one role and everything it grants
```

```sql
SELECT r.key, count(*) FROM roles r
  JOIN role_permissions rp ON rp.role_id = r.id GROUP BY r.key;
```

### 7.1 Why the machinery survived the collapse

`roles`, `role_permissions` and `user_roles` still exist, the guards still
check permission strings, and no guard anywhere contains a role name. With one
role that is all redundant — and it stays, because the alternative is
hard-coding "is staff" into ninety-odd call sites and rebuilding this when a
second role is next wanted. The cost of keeping it is three joins on a request
that already touches the database.

### 7.2 Permissions are no longer carried in the token

They used to be, and one role holding all of them made that impossible: the
staff session cookie reached 4642 bytes, past what a browser will store. The
token now carries `sub`, `aud` and `sid` only, and the guard resolves
permissions per request.

The size forced the change; it was not the reason to want it. A permission
baked into a token at login cannot be revoked until the token expires, which
means "remove this person's access" does not mean now. See
[`phase-8.md`](phase-8.md) §2.2.

### 7.3 Phase 9 additions

`team.read` and `team.manage` — two, following `event.*`, rather than the five
a create/update/publish/archive/reorder split would give, because publishing a
team member is a status change on a record the caller may already edit and a
separate permission for the last step is ceremony rather than control. And
`impact.update`, mirroring `story.update`: letting `impact.create` cover edits
conflates "may write a new draft" with "may rewrite a number that is already on
the site". `impact.publish` stays separate for the opposite reason — publishing
a figure stamps you as its verifier.

### 7.4 Phase 8 added no permissions

Worth stating, because it is the good outcome. The volunteer permissions were
catalogued in Phase 3 — `volunteer.read`, `volunteer.update`,
`volunteer.approve`, `volunteer.suspend`, `volunteer.assign`,
`volunteer.attendance`, `volunteer.export`, `volunteer.read_documents` — and
sat unused because nothing wrote to the table. Phase 8 wired the routes to
them as they stood.

The split between `volunteer.approve` and `volunteer.attendance` earns its
keep now that both are real: approving somebody is a judgement about a person,
recording their hours is a clerical act, and the hours end up on a signed
document.

`volunteer.read_documents` remains unused. Volunteer document upload is out of
scope (see [`phase-8.md`](phase-8.md) §7) and the permission is the only part
of it that exists.

Certificates are governed by `volunteer.approve` rather than a permission of
their own: issuing one is the same kind of act as approving somebody — a
statement the organisation signs — and giving it a separate key would have
suggested the two can be held apart, which under a single role they cannot.
