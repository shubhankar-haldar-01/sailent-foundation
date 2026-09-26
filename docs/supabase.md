# Connecting to Supabase

Written for: whoever sets this platform up against a hosted database, or debugs
it when it will not connect.

The repository already had everything needed — `drizzle-orm`, `drizzle-kit`,
`pg`, and a connection inspector that recognises Supabase's three connection
kinds. **Nothing needs installing.** What follows is the configuration.

---

## 1. Which connection string

Supabase offers three, and they are not interchangeable:

| Kind | Host / port | Use it? |
|---|---|---|
| Direct | `db.<ref>.supabase.co:5432` | Yes, but IPv6-only on the free tier |
| **Session pooler** | `aws-N-<region>.pooler.supabase.com:**5432**` | **Yes — this is the right one** |
| Transaction pooler | `aws-N-<region>.pooler.supabase.com:**6543**` | **No** |

`inspectConnection()` classifies these and sets `safeForMigrations` to false for
the transaction pooler, which is the one that matters: transaction mode does not
support prepared statements or session state, and this platform depends on
multi-statement transactions and `SELECT … FOR UPDATE` for donation capture and
event-registration capacity. A transaction-pooler URL appears to work and then
fails under exactly the concurrency those locks exist for.

The port is the tell. `5432` on a `pooler` host is session mode.

---

## 2. Percent-encode the password

This is the failure that costs an afternoon.

A Supabase-generated password can contain `@`, and a URL splits userinfo from
host at the **last** `@`. An unencoded one silently reparses the URL:

```
postgresql://postgres.abc:pa@ss@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
                             ↑ splits here
→ host becomes "ss@aws-0-ap-south-1.pooler.supabase.com"
→ "could not translate host name"
```

Encode `@` as `%40`. The same applies to `:` `/` `?` `#` `[` `]` — anything
reserved in a URI. If in doubt, run the password through
`encodeURIComponent()`.

---

## 3. The CA certificate

Supabase signs its database certificates with **its own root**, "Supabase Root
2021 CA", which Node does not ship. Connecting with verification on therefore
fails:

```
Error: self-signed certificate in certificate chain  (SELF_SIGNED_CERT_IN_CHAIN)
```

**The usual "fix" for this is to turn verification off, and that is the wrong
move.** `sslmode=require`, and `rejectUnauthorized: false`, encrypt against a
passive listener and are wide open to an active one — on a connection carrying
donor PII and password hashes. The client refuses to make that trade by default.

The right fix is to trust their root, which keeps the chain check *and* the
hostname check:

```
DATABASE_CA_CERT="infrastructure/certs/supabase-prod-ca-2021.crt"
```

The certificate is a public root, not a secret, so it lives in the repository.
The path is resolved against the **repository root**, not the working directory
— the API runs from `apps/api`, the worker from `apps/worker` and migrations
from `packages/database`, so one setting covers all four.

A configured path that cannot be read **throws**. Falling back to the default
roots would mean a deployment that believes it pinned a CA and did not.

To refresh it:

```
curl -o infrastructure/certs/supabase-prod-ca-2021.crt \
  https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
openssl x509 -in infrastructure/certs/supabase-prod-ca-2021.crt -noout -subject -dates
```

Verify the subject reads `CN=Supabase Root 2021 CA` and that it matches the root
of the chain the server presents:

```
echo | openssl s_client -starttls postgres \
  -connect aws-0-ap-south-1.pooler.supabase.com:5432 -showcerts 2>/dev/null \
  | grep -E "^ *[0-9]+ s:"
```

---

## 4. Bringing a fresh project up

```
pnpm --filter @sailent/database db:migrate   # 35 tables
pnpm --filter @sailent/database db:seed      # reference data, + demo content in development
```

`db:migrate` prints what it is pointed at before it does anything, so a
misconfigured URL is visible before it writes.

The seed's demo content — the five staff accounts, programmes, campaigns, events
— is gated on `APP_ENV`. A production seed writes permissions, roles, categories
and settings only.

---

## 5. Tests do not run against it

The integration suites contain **46 `DELETE` statements**. Teardown is how they
stay repeatable, and two of them sweep by pattern to catch rows whose create
succeeded and whose assertion did not. Against a local throwaway database that
is correct; against a hosted one it is a data-loss incident.

The trigger is quiet: point `DATABASE_URL` at Supabase to see the app run with
real infrastructure, then run `pnpm test` an hour later out of habit.

So `apps/api/test/harness.ts` refuses a non-local database **before the app
boots**, rather than after the first `afterAll`:

```
Error: Integration tests delete rows and aws-0-….pooler.supabase.com:5432
       (supabase-session-pooler) is not a local database.
```

`TEST_DATABASE_URL` is how both work at once — the app on Supabase, the suites
on a local container:

```
TEST_DATABASE_URL="postgres://sailent:sailent@localhost:5432/sailent_dev"
```

`ALLOW_REMOTE_TEST_DB=true` overrides the check, for a disposable CI database
that is meant to be written to. It is not for a database anybody cares about.

**Redis is isolated the same way, and for a related reason.** The suites
enqueue REAL jobs — a donation-capture test writes a donation, the capture
enqueues a confirmation email, and teardown deletes the donation. The job stays
in Redis. Whenever a worker next starts it drains that backlog, finds nothing
at the other end, and logs one error per orphan:

```
ERROR: Confirmation job for a donation that does not exist
```

Twenty-one of them, after an ordinary test run. Nothing is broken — the
processor's missing-row guard is doing exactly its job — but an ERROR that
fires routinely teaches whoever reads the log that ERROR means nothing.

`TEST_REDIS_URL` points the suites at a different Redis **database index**:

```
TEST_REDIS_URL="redis://localhost:6379/1"
```

Same server, no sharing. Test jobs land where no worker is listening.

The Playwright suite is a different case: it drives the running application, so
it uses whatever that application is pointed at. It writes far less — donors and
OTP rows in global setup — but it does write, so treat a Supabase-backed e2e run
as touching that data.

---

## 6. Reading the startup log

Every process that opens a pool now says so, and says whether the database
actually answered:

```
[Database] Connecting to aws-0-ap-south-1.pooler.supabase.com:5432 (supabase-session-pooler) — TLS verified
[Database] Database ready — aws-0-ap-south-1.pooler.supabase.com:5432 (supabase-session-pooler) (644ms)
[Database] That round trip took 644ms. Every query pays this — expect the
           application to feel slower than it does against a local database.
```

**Two lines, not one, because `new pg.Pool()` does not connect.** It is lazy —
the first connection is opened by the first query. The single line this
replaced printed "Connected to …" just as cheerfully with a wrong password, an
unreachable host or a rejected certificate, and the real failure surfaced
seconds later as a 500.

On failure it names the cause and the fix rather than the symptom:

| What you see | What it means |
|---|---|
| `self-signed certificate in certificate chain` | Set `DATABASE_CA_CERT` (§3). Do not disable verification. |
| `getaddrinfo ENOTFOUND` | Usually an unescaped `@` in the password (§2). |
| `password authentication failed` | The credential is wrong. |

An unrecognised failure gets one line: the error itself. Guessing at a cause
sends people the wrong way more expensively than saying nothing.

**It never throws.** Every route needs the database, so crashing at boot is
tempting — but it takes the health endpoint down with it, and that is what the
platform reads to decide whether to route traffic. A transient blip would
become a restart loop. The connection is reported honestly and
`/health/ready` reports `down`, which is the thing that should gate traffic.

`db:migrate` and `db:seed` print the same report **before writing anything** —
the seed writes five staff accounts with a known password, so knowing which
database it is about to touch matters as much as it does for a migration.

---

## 7. Pool sizing

Supabase's session pooler has a connection ceiling that varies by plan. The
defaults here are deliberately modest: the API pools 10 and the worker 4, set at
their call sites. Raise them only against a measured ceiling — exhausting the
pooler produces timeouts that look like application slowness.
