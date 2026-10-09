# API development

The REST conventions every Sailent Foundation endpoint follows, and the endpoint map as built in Phase 3.

Design rationale lives in [`api-architecture.md`](api-architecture.md); this is the working reference.

---

## 1. Conventions

**Base URL** `/api/v1`. The version is in the path so an incompatible change can ship alongside the old shape rather than breaking every client at once.

**Resources are plural nouns.** Actions that are not CRUD are sub-resources: `POST /admin/users/:id/suspend`, not `POST /admin/suspend-user`.

**Methods** — `GET` reads, `POST` creates or performs an action, `PATCH` partially updates, `DELETE` removes. `PUT` is unused: nothing in this API replaces a whole resource.

### The success envelope

```json
{
  "success": true,
  "data": { … },
  "meta": { "requestId": "0f2c…" }
}
```

Paginated collections put the envelope inside `data`:

```json
{
  "success": true,
  "data": {
    "items": [ … ],
    "pagination": {
      "page": 1, "limit": 20, "total": 47,
      "totalPages": 3, "hasNext": true, "hasPrevious": false
    }
  },
  "meta": { "requestId": "0f2c…" }
}
```

### The error envelope

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The submitted data is not valid.",
    "details": [{ "field": "email", "code": "invalid_string", "message": "Enter a valid email address" }],
    "requestId": "0f2c…"
  }
}
```

`message` is for a person. `code` is for the client, and is stable — clients branch on it, never on the message text.

| Code | HTTP | Means |
|---|---|---|
| `VALIDATION_FAILED` | 422 | The body or query did not parse. `details` names each field. |
| `UNAUTHENTICATED` | 401 | No valid session. |
| `FORBIDDEN` | 403 | Authenticated, but not permitted. |
| `REAUTH_REQUIRED` | 403 | Permitted, but the session is not fresh enough for a sensitive operation. |
| `NOT_FOUND` | 404 | No such resource — or it is not published. |
| `CONFLICT` | 409 | Conflicts with current state (duplicate email, already suspended). |
| `RATE_LIMITED` | 429 | Too many requests. |
| `INTERNAL_ERROR` | 500 | Our fault. The message is generic in production. |
| `SERVICE_UNAVAILABLE` | 503 | A dependency is down. |

`REAUTH_REQUIRED` is deliberately distinct from `FORBIDDEN` despite sharing a status: the client's correct response is to ask for the password again, not to hide the control.

A 403 says "you do not have access" rather than pretending the record does not exist. A 404 that hides an authorization failure wastes an operator's afternoon.

### Pagination, filtering, sorting

| Parameter | Default | Notes |
|---|---|---|
| `page` | 1 | 1-indexed |
| `limit` | 20 | **Maximum 100.** 101 is rejected, not clamped. |
| `sort` | per endpoint | `field` ascending, `-field` descending. Allow-listed. |
| `q` | — | Free-text search where supported |

A page past the end returns an empty `items` array with correct pagination metadata — not a 404. "There is nothing here" is an answer.

### Request correlation

Send `x-request-id` and it is echoed back and attached to every log line for that request. Omit it and one is generated. Either way it appears in `meta.requestId` or `error.requestId`.

### Money

Always **integer paise** (decision A2). `45000000` is ₹4,50,000. No endpoint accepts or returns a decimal amount, and no client should do arithmetic on money beyond formatting it.

---

## 2. Endpoint map

32 endpoints. `auth` column: **—** public, **D** donor token, **S** staff token + the named permission.

### Public content

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/programs` | — | Published only. Paginated. |
| GET | `/programs/:slug` | — | With campaigns, stories and impact updates |
| GET | `/campaigns` | — | Filters: `status`, `programSlug`, `category`, `state`, `q` |
| GET | `/campaigns/:slug` | — | With products and related stories |
| GET | `/campaigns/:slug/products` | — | Active products only |
| GET | `/stories` | — | Published only. Paginated. `category` filter (case-insensitive); each row's `category` is the story's own, else its programme's |
| GET | `/stories/:slug` | — | Consent enforced at the database |
| GET | `/events` | — | `when=upcoming\|past` |
| GET | `/events/:slug` | — | `meetingUrl` stripped |
| GET | `/team` | — | Ordered for display, not paginated |
| GET | `/impact` | — | Live aggregates, computed reach, dated updates |

Every one returns **published, non-deleted** rows. There is no query parameter that changes that, and no preview mode. Drafts are 404 to the public, exactly as if they did not exist.

Fields stripped on the way out: `internalNotes` (campaigns), `meetingUrl` (events), `consentDocumentId` (stories).

### Authentication

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/staff/login` | — | Email + password + TOTP where the role requires it. 5/min. |
| POST | `/auth/donor/otp/request` | — | Always 200. 3 per 15 min. |
| POST | `/auth/donor/otp/verify` | — | 10 per 15 min |
| POST | `/auth/refresh` | — | Rotates; reuse revokes the family |
| POST | `/auth/logout` | — | Revokes the family. 204. |
| GET | `/auth/me` | any staff | Actor, permissions, re-auth freshness |
| POST | `/auth/reauth` | any staff | Opens the five-minute sensitive window |

### Staff administration

| Method | Path | Permission | Sensitive |
|---|---|---|---|
| GET | `/admin/users` | `user.read` | |
| GET | `/admin/users/:id` | `user.read` | |
| POST | `/admin/users` | `user.invite` | ✅ |
| PATCH | `/admin/users/:id` | `user.update` | |
| POST | `/admin/users/:id/roles` | `user.assign_role` | ✅ |
| POST | `/admin/users/:id/suspend` | `user.suspend` | ✅ |
| POST | `/admin/users/:id/reactivate` | `user.suspend` | ✅ |
| GET | `/admin/roles` | `role.read` | |
| GET | `/admin/roles/:key` | `role.read` | |
| GET | `/admin/permissions` | `role.read` | |
| GET | `/admin/audit-logs` | `audit.read` | |

**Sensitive** operations additionally require a re-authentication within the last five minutes, and always write an audit row.

The audit log has no write path through the API and never will (decision A10).

### Operational

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | — | Liveness. Touches nothing. |
| GET | `/health/ready` | — | Database, Redis, queue. Reports depth, never connection detail. |
| POST | `/dev/queue/example` | — | Refused in production at the handler |

---

## 3. OpenAPI

`http://localhost:4000/api/v1/docs`, JSON at `/api/v1/docs-json`. Disabled in production by configuration.

Two bearer schemes are declared, `staff` and `donor`, because they are **not interchangeable** — a donor token presented to a staff route does not merely fail authorization, it fails verification, since the two audiences are signed with different derived keys.

Every endpoint carries a summary. Adding one without `@ApiOperation` means the admin UI's generated client has an unnamed method, so the document is checked as part of the Phase 3 verification.

---

## 4. Adding an endpoint

```ts
@ApiTags('admin: campaigns')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin')
export class CampaignAdminController {
  @RequirePermission('campaign.publish')
  @Sensitive()
  @Post('campaigns/:id/publish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Publish a campaign' })
  @ApiResponse({ status: 403, description: 'Missing campaign.publish, or REAUTH_REQUIRED' })
  publish(
    @Param(new ZodValidationPipe(idParamSchema)) params: { id: string },
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.campaigns.publish(params.id, actor);
  }
}
```

Checklist:

- [ ] `@Public()` or `@RequirePermission(…)`. Never neither.
- [ ] `@Sensitive()` if it moves money, changes permissions, exports data or changes visibility.
- [ ] Zod schema for every body, query and param.
- [ ] Explicit column projection — never `select()` then delete.
- [ ] Audit row for every state change, with a reason where a human made a judgement.
- [ ] Swagger annotations including the failure statuses.
- [ ] Integration test asserting the **refusal**, not just the success.
