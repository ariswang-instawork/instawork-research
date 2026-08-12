# Instawork Research Sessions

A web app that lists paid Instawork research sessions on a map, lets visitors browse
sessions by location, and (when authenticated via Instawork OAuth) checks per-site
booking eligibility. Single Node process: an Express API that also serves the React +
Vite client. Data is synced from Mode Analytics into Postgres via Prisma.

- Backend: Express (TypeScript, run with `tsx`), Prisma ORM → PostgreSQL.
- Frontend: React 18 + Vite + Tailwind v4 + wouter, served by the same process (Vite
  middleware in dev, static files in prod).
- Standard commands live in `package.json` (`dev`, `build`, `start`, `check`, `db:push`).
- Architecture / OAuth / API details: see `replit.md`.

## Cursor Cloud specific instructions

Environment specifics for agents running in the prebuilt Cursor Cloud VM (the update
script has already run `npm install` + `npx prisma generate`).

### Services

One service: the combined API + web dev server. Start it with `npm run dev` (serves API
and client on `http://localhost:5000`). There is no separate frontend process. `tsx` does
not type-check, so the app runs even though `npm run check` currently reports a
pre-existing type error in `server/routes.ts` (`req.headers` typing) — that error is not
caused by environment setup.

### Postgres is required and not auto-started

The app needs a running PostgreSQL and a `DATABASE_URL`. Postgres 16 is installed in the
image but is **not** started automatically on boot. Before running the app:

```bash
sudo pg_ctlcluster 16 main start   # start Postgres (no-op if already running)
```

The dev database `instawork` and role `dev` (password `devpass`) already exist in the
image. If the tables are missing (fresh DB), create them with `npx prisma db push` (needs
`DATABASE_URL` set). `prisma db push` is a schema sync, so it is safe to re-run.

### Environment variables

Required runtime env vars are exported from `~/.bashrc` (added during setup), so any login
shell — including `npm run dev` started from one — already has them:

- `DATABASE_URL=postgresql://dev:devpass@localhost:5432/instawork`
- `PORT=5000`
- `INSTAWORK_BASE_URL`, `INSTAWORK_CLIENT_ID`, `INSTAWORK_CLIENT_SECRET`, `SESSION_SECRET`
  (OAuth + session config, values mirrored from `.replit`).

Note: the runtime (`tsx server/index.ts`) does **not** load `.env`; it relies on the
process environment. The Prisma CLI, however, does read `.env`.

### Data / Mode sync

On boot the server tries to sync shift/booking data from Mode Analytics. Without the Mode
secrets (`MODE_API_TOKEN`, `MODE_API_SECRET`, `MODE_REPORT_TOKEN`, `MODE_QUERY_TOKEN`,
`MODE_BOOKINGS_REPORT_TOKEN`, `MODE_BOOKINGS_QUERY_TOKEN`) the sync fails gracefully and
the app runs with an empty dataset — the map and session list will be empty but the app is
fully functional. To exercise the session-browsing UI without Mode access, insert sample
rows into the `shift_group` table (a row is "servable" when `is_overbook_shift_group` is
false, `open_shifts_count > 0`, `shift_date >= today`, and `shift_link` is a valid https
URL). The OAuth login and `/api/eligibility` flow require real Instawork OAuth and cannot
be completed headlessly.
