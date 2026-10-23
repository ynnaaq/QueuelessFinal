# Queueless

React + Vite school queue application with an Express API and persistent SQLite storage. Requires Node.js 24 or later. No separate database installation is needed.

## Start locally

Run these commands from the inner `Queueless-Improved-Responsive` folder (the folder containing this README and `src`):

```powershell
npm install
# Only if you do not already have .env:
Copy-Item .env.example .env
npm run server
```

In a second terminal in the same folder:

```powershell
npm run dev
```

Open the URL printed by Vite. Vite forwards `/api` requests to the API on port 3001 (or `PORT` in `.env`). Both processes must be running. `npm run build` produces the frontend bundle; `npm run preview` alone does not run the API.

The local `.env` enables `SEED_DEMO=true`. On the first database initialization this creates:

| Role | Email | Password |
| --- | --- | --- |
| Student | maria@student.edu | student123 |
| Staff (Registrar) | staff@school.edu | staff123 |
| Admin | admin@school.edu | admin123 |

For a new database without demo accounts, set `SEED_DEMO=false`, `ADMIN_EMAIL`, and an `ADMIN_PASSWORD` of at least 8 characters. Seeding only runs on a new database; changing these values does not reset existing accounts or passwords. Choose a different `DATABASE_PATH` to initialize a separate database.

## Working flows

- Students self-register, sign in, join one queue, reserve a future visit date, track their actual position, cancel, view persisted history, and review completed visits once.
- Staff can self-register by selecting Staff and an assigned office, or be created by an administrator. Registration immediately signs them in to the staff dashboard. Staff can call the first waiting ticket, skip, recall to the front, and mark a called ticket served. Staff access is limited to their assigned office.
- Administrators see real accounts, queues, ratings, and performance; create staff; suspend/reactivate students and staff; open/close offices; and update service requirements.
- Profile and password changes are saved. School IDs and staff office assignments cannot be changed through self-service profiles.
- Dashboards poll every 4 seconds. A student can only be marked served by authorized staff/admin; there is no simulated queue movement or client-side demo authentication.
- Future reservations remain outside today's staff waiting list until their visit date. An existing active reservation must be cancelled before joining another queue. Campus dates use Asia/Manila.
- Skipped tickets remain active until recalled or cancelled. Past uncompleted tickets can be cancelled by their owner.

Try the Student and Staff accounts in separate browser profiles: join Registrar as the student, call and serve the ticket as staff, then watch the student history update and submit feedback. The Admin account can see the resulting review and counts.

## API

Authenticated requests use `Authorization: Bearer <token>` and JSON bodies. Errors return `{ "message": "..." }` with an appropriate 4xx/5xx status.

| Method | Path | Access / body |
| --- | --- | --- |
| GET | /api/health | Public health check |
| POST | /api/auth/register | Public; name, email, password, accountId, role student or staff; students require accountId, staff require office; optional department/yearLevel |
| POST | /api/auth/login | Public; email, password; returns token and user |
| POST | /api/auth/verify-email | Public; email and six-digit code; activates an account email |
| POST | /api/auth/resend-verification | Public; email; sends a new account-verification code when required |
| POST | /api/auth/forgot-password | Public; email; sends a six-digit reset code when the account exists |
| POST | /api/auth/reset-password | Public; email, six-digit reset code, and replacement password |
| GET | /api/auth/me | Any signed-in account |
| POST | /api/auth/logout | Invalidate current session |
| PATCH | /api/auth/profile | name, email, department, yearLevel, optional password |
| GET | /api/portal/state | Offices, role-filtered tickets and feedback; admin also receives users |
| POST | /api/tickets | Student; officeId (ID or name), service, optional visitDate YYYY-MM-DD |
| PATCH | /api/tickets/:id/cancel | Ticket owner |
| POST | /api/tickets/:id/action | Assigned staff or admin; action: call, skip, recall, serve |
| POST | /api/tickets/:id/feedback | Owner of served ticket; integer rating 1–5, optional comment |
| PATCH | /api/offices/:id | Admin; boolean open |
| POST | /api/offices/:id/requirements | Assigned staff/admin; requirement, optional serviceIndex |
| POST | /api/admin/staff | Admin; name, email, password, office |
| PATCH | /api/admin/users/:id | Admin; status Active, Suspended (student), or Inactive (staff) |

Sessions last five minutes and survive API restarts. Passwords use salted scrypt hashes; only hashes of session tokens are stored. Suspension revokes sessions and cancels active student tickets. Password changes revoke other sessions. Authentication endpoints are rate limited.

## Storage and verification

Default database: `server/data/queueless.sqlite`. SQLite transactions serialize queue changes, preventing duplicate active tickets, reused numbers after cancellation, and multiple serving tickets per office. The small local backend stores its state as a JSON document within SQLite and rewrites that document per mutation. This is intended for local/small deployments; a larger deployment should use normalized tables, indexed queries, pagination, and a deployment-specific authentication/recovery setup.

```powershell
npm test
npm run lint
npm run build
```

Tests use isolated databases and cover authentication, role enforcement, student-data privacy, office assignments, concurrent joins, FIFO transitions, feedback, suspension, profile updates, logout, date reservations, and restart persistence. They do not modify your working database.

## Password reset email

The server sends verification and password-reset codes through Resend. Configure these server environment variables on the API host (Render): `RESEND_API_KEY` and `EMAIL_FROM`.

`EMAIL_FROM` must use a sender address from a domain verified in Resend, for example `Queueless <no-reply@your-school-domain.edu>`. Resend testing mode can send only to the Resend account owner's email address; verify a domain before sending to students. Keep `RESEND_API_KEY` server-side only—never expose it as a `VITE_` variable or commit it to `.env`.

New accounts cannot sign in until the recipient verifies their email with a six-digit code. Recovery codes expire after 10 minutes, allow at most five incorrect attempts, and resetting a password signs out every existing session.

## Security controls

Queueless validates every API input, uses salted `scrypt` password hashes, stores only hashes of opaque session tokens and OTPs, and applies role checks to student, staff, and admin actions. Authentication endpoints are throttled; verification and recovery codes also expire after 10 minutes and lock after five invalid attempts. Account registration requires privacy-notice consent, and the system keeps only the account information needed for campus queue services. Responses include anti-clickjacking, MIME-sniffing, referrer, permissions, CSP, and HTTPS/HSTS protections. Deploy behind HTTPS and set `FRONTEND_URL` to the exact approved frontend origin.

For deployment, serve the built frontend and `/api` under the same HTTPS origin, set a non-demo database and admin credentials, and arrange database backups. The API binds to `127.0.0.1` by default; configure `HOST` only when external API access is intended.
