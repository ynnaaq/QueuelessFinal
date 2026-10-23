# Queueless initial audit — 2026-10-22

This is an evidence-based audit of the checked-in code. It is not a claim that
the deployed Render, Atlas, Vercel, or Supabase environments were reachable.
No secret values were inspected.

## Critical

- The automated server tests are not isolated from MongoDB. `npm test` starts
  Express without connecting MongoDB and both suites time out on buffered
  Mongoose queries. The old test options still refer to a removed SQLite test
  adapter. No backend change should be considered fully verified until this is
  replaced with an isolated MongoDB test database or a MongoDB memory server.
- The legacy local-auth endpoints and data fields remain alongside the
  Supabase flow. The browser uses Supabase, but a deployment still exposes
  local registration/login/reset routes. A deliberate, tested account-migration
  decision is required before they can safely be removed.

## High

- A temporary API/network failure previously erased the browser's saved
  session. This has been fixed: only an explicit expired-session response now
  clears it.
- Queue creation previously depended on a read-then-write active-ticket check.
  A MongoDB partial unique index has been added to enforce one active ticket
  per student; the production database must successfully build it.
- Staff `call` still uses a read/check/save sequence. A partial unique index
  now prevents two serving tickets for the same office/date, but the route
  should be converted to a conditional atomic update and tested under
  simultaneous requests.
- The admin interface calls audit-log endpoints that were absent from the
  backend. Those protected endpoints are now implemented, but sensitive
  backend operations should also create logs server-side rather than relying
  on the UI to report them.

## Medium

- `README.md` describes a retired SQLite architecture, self-registration, and
  outdated deployment behavior. `MONGODB-FIX.md` is closer to current state
  but incomplete. Documentation needs consolidation before handoff.
- The API is largely one `server/app.js` module. This makes route-level testing
  and safe changes harder; route/service extraction should be incremental.
- `AuditLog` captures action and subject but has no structured before/after
  metadata or request correlation.
- The production health endpoint reports MongoDB connection state but cannot
  prove Supabase or outbound email availability; those should have separate
  dependency checks if operations require them.

## Low

- Production build succeeds, but Vite reports a 558 kB JavaScript bundle.
  Lazy-loading dashboard routes is a reasonable performance follow-up.
- Several visible text strings show encoding corruption (for example `â€¦` and
  `â€“`), which should be corrected in a dedicated UI pass.

## Changes in this stage

- Preserve valid browser sessions during transient outages.
- Add safer MongoDB startup diagnostics and shutdown handling.
- Add health connection status, protected audit-log API endpoints, and MongoDB
  uniqueness constraints for active and serving queue tickets.

## Deployment checklist

1. In Render, set `MONGODB_URI`, `MONGODB_DB_NAME`, `SUPABASE_URL` (or the
   matching `VITE_` variable where intentionally used),
   `SUPABASE_PUBLISHABLE_KEY`, and exact `FRONTEND_URL`. Do not put secrets in
   Vercel `VITE_` variables.
2. In Atlas, create the application database user, URL-encode special
   characters in its password, add Render's outbound network access according
   to the school's Atlas policy, and use a URI whose database/cluster match
   the deployment. Verify Render logs never print the URI.
3. Build the new Ticket indexes during a maintenance window. Resolve any
   existing duplicate active or serving records before retrying index creation.
4. In Vercel, set `VITE_API_URL` only if the rewrite in `vercel.json` is not
   used; otherwise use same-origin `/api`. Confirm the Render URL is the
   intended production API.
5. In Supabase, configure the production site URL and redirect URLs for email
   confirmation/recovery, then verify one registration, sign-in, refresh, and
   password recovery using non-production test data.
