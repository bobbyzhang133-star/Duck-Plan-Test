# DuckPlan Cloudflare backend

Implements the **Backend Plan** in `plans.md` on Cloudflare (it replaced the earlier Supabase backend).
One Worker serves the static site in `landing/` **and** the API under `/api`, on the same origin, so
sign-in is a plain first-party HttpOnly cookie.

| Supabase piece (before)            | Cloudflare piece (now)                                         |
| ---------------------------------- | -------------------------------------------------------------- |
| Postgres + row-level security      | **D1** (SQLite); every query is scoped to the session's user   |
| Supabase Auth (magic link, Google) | Worker auth: **Email Service** magic links + Google OIDC/PKCE  |
| Realtime on `items` / `classes`    | **Durable Object** `PlannerLive` per user (WebSocket hibernation) |
| `axis-sync` Edge Function          | `src/axis.js` in the same Worker                               |
| pg_cron + pg_net + Vault           | **Cron Trigger** (`*/30 * * * *`) — no shared secret needed    |
| Netlify static hosting             | Workers **static assets** (Netlify still works, local-only)    |

```
cloudflare/
  wrangler.jsonc            bindings: D1 (DB), Durable Object (LIVE), Email (EMAIL), assets, cron; dev + production envs
  migrations/0001_initial_schema.sql   tables, ownership triggers, checks
  seed.sql                  demo user, classes, and tasks (local/dev only)
  src/index.js              router, /cloud-config.js, /api/live, scheduled()
  src/auth.js               sessions, magic links, Google sign-in
  src/planner.js            classes/items CRUD, local-task import
  src/axis.js               Axis connect / sync / cron (imports ../../landing/ical-parser.js directly)
  src/live.js               PlannerLive Durable Object + broadcast()
```

## API

All routes are JSON, need the session cookie (except auth), and reject cross-site `Origin`s.

| Route                                   | What it does                                          |
| --------------------------------------- | ----------------------------------------------------- |
| `GET /api/session`                      | `{ user, providers }`                                 |
| `POST /api/auth/email` `{ email, next }`| emails a single-use 15-minute link (3 per 15 min)     |
| `POST /api/auth/email/verify` `{ token }` | spends the link, sets the session cookie            |
| `GET /api/auth/google?next=/`           | Google sign-in (callback: `/api/auth/google/callback`)|
| `POST /api/auth/sign-out`               | ends the session                                      |
| `GET /api/planner`                      | `{ classes, items }` (soft-deleted items left out)    |
| `PUT/PATCH/DELETE /api/items/:id`       | upsert, `{ completed }`, soft delete                  |
| `PUT /api/classes/:id`                  | upsert (archive with `archived: true`)                |
| `POST /api/import` `{ classRows, itemRows }` | first-sign-in local import, one transaction      |
| `GET/POST/DELETE /api/axis`             | status, `{ mode: "connect", icalUrl }` / `{ mode: "sync" }`, disconnect |
| `GET /api/live` (WebSocket)             | `{ table, row }` and `{ reload: true }` messages      |

`landing/cloud-config.js` ships with `apiUrl: ""`, so any copy of the site **not** served by this
Worker (Netlify, `python3 -m http.server`) stays local-only. The Worker answers that file itself with
`apiUrl: "/api"`.

## Run it locally

```sh
cd cloudflare
npm install
cp .dev.vars.example .dev.vars      # EMAIL_MODE=log prints sign-in links in the terminal
npm run db:migrate:local
npm run db:seed:local               # optional: demo@duckplan.test with sample tasks
npm run dev                         # → http://127.0.0.1:8787/  (site + API, labeled local)
```

Sign in with any email; the link appears in the `wrangler dev` output. Trigger the Axis cron locally
with `curl "http://127.0.0.1:8787/cdn-cgi/handler/scheduled?cron=*/30+*+*+*+*"`.

## Test

```sh
node --test tests/                  # from the repo root; includes tests/cloudflare-worker.test.mjs
npm run check                       # (in cloudflare/) wrangler dry-run bundle of dev and production
```

`tests/cloudflare-worker.test.mjs` runs the real migration on Node's built-in SQLite with D1's
limits (50-character LIKE/GLOB patterns, 100 bound parameters) and covers auth, user isolation (the
old RLS test), the Axis sync rules, cron, Google sign-in, and the browser store against the Worker.

## Hosted environments

**Status (2026-11-05):** both D1 databases exist (their ids are in `wrangler.jsonc`). **Dev is live** at
<https://duckplan-dev.duckplan-cloudflare.workers.dev> with the migration applied (no seed). The
account has no domain yet, so dev runs with `EMAIL_MODE=log`: to sign in, request a link on the site
while `npx wrangler tail duckplan-dev` is running and open the link it prints. Only the account owner
can read those logs. **Prod (`duckplan-prod`) is empty:** no migration, no Worker.

## Set up the hosted environments (one time)

Needs a Cloudflare account and a domain added to Cloudflare (Email Service sends from it). Without a
domain, dev can still run with `EMAIL_MODE: "log"` in its `vars` (see Status above).

```sh
cd cloudflare
npx wrangler login
npx wrangler d1 create duckplan-dev        # paste the id into wrangler.jsonc (top-level d1_databases)
npx wrangler d1 create duckplan-prod       # paste the id into env.production.d1_databases
```

1. **Email:** onboard your domain in **Email Service**, then set `EMAIL_FROM` (both envs) to an
   address on it, e.g. `sign-in@duckplan.example`.
2. **Google (optional):** create an OAuth client (Web application) in Google Cloud. Add the redirect URI
   `https://<worker-host>/api/auth/google/callback` for each environment, then
   `npx wrangler secret put GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (add `--env production` for prod).
   The "Use Google" button only appears once these are set.
3. **Dev:** `npm run db:migrate:dev && npm run deploy:dev` → `https://duckplan-dev.<account>.workers.dev`.

**Prod is a deployment.** Under the local-first-release rule, `db:migrate:prod`, `deploy:prod`, and
moving the public site from Netlify to the Worker (or adding a custom domain) all need explicit approval.

## Rules the code relies on

- D1 has no row-level security: **every** SQL statement in `src/` filters or writes by the session's
  `user_id`. The schema adds a second lock (an item can only point at its owner's class; rows can't
  change owner). `tests/cloudflare-worker.test.mjs` checks user A can't read or change user B's rows.
- Deadlines are `due_date` `YYYY-MM-DD` + `due_time` `HH:MM` (local wall-clock), never time-zone timestamps.
- Ids come from the client (`crypto.randomUUID()`); deletes set `deleted_at`.
- Axis writes only `title`, `due_date`, `class_id`, `notes` (and `axis_missing`); it never touches
  `completed`, `scheduled_start`, or `priority`, and skips completed or deleted items.
- `axis_connections.ical_url` is never returned by any route or written to logs.
- Session and sign-in tokens are stored only as SHA-256 hashes.
- Keep LIKE/GLOB patterns under 50 characters (D1 rejects longer ones at write time).
- Never commit a real Axis feed or feed link; `tests/fixtures/axis-feed.ics` is made up.
