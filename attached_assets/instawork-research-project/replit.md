# Instawork Research Sessions

Mobile-first web app where research participants find open, paid in-person Voice Research Sessions near them and tap through to book on Instawork.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` (auto-provided)
- Mode sync secrets: `MODE_API_TOKEN`, `MODE_API_SECRET`, `MODE_WORKSPACE` (`instawork`), `MODE_REPORT_TOKEN` (`fae0d254a724`), `MODE_QUERY_TOKEN` (`bc06247bf605`), `CRON_SECRET`, `ADMIN_PASSWORD`; optional `MODE_BOOKINGS_REPORT_TOKEN` (`96ab0fecf5dc`) + `MODE_BOOKINGS_QUERY_TOKEN` (`63de9ec01a1c`) — both required to enable the eligibility check (hidden otherwise); set as shared env vars

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5; DB: PostgreSQL + Drizzle ORM (spec asked for Prisma; adapted to workspace-standard Drizzle)
- Validation: Zod; API codegen: Orval (from `lib/api-spec/openapi.yaml`)
- Frontend: React + Vite + Tailwind at `artifacts/research-sessions` (previewPath `/`)

## Where things live

- DB schema: `lib/db/src/schema/` (`shift_group`, `sync_run`, `participant_booking`)
- Mode → Postgres sync: `artifacts/api-server/src/lib/modeSync.ts` (boot + every 10 min in-process; also `POST /api/cron/sync-mode` with `x-cron-secret` for a Scheduled Deployment)
- Serving rules & label sanitizer: `artifacts/api-server/src/lib/serving.ts`, `sanitize.ts`
- Routes: `artifacts/api-server/src/routes/research.ts` (sites/sessions/eligibility/app-health), `admin.ts` (admin + cron)
- Frontend screens: `artifacts/research-sessions/src/pages/` — location gate + landing (`/`), sessions (`/sessions`), detail (`/sessions/:id`), admin (`/admin`)
- Restricted-states list: single exported constant in the frontend requirements section

## Architecture decisions

- Sync replaces `shift_group` atomically; 0-row or failed fetches keep last-known data (recorded in `sync_run`)
- API layer only serves upcoming, open, non-overbook rows with valid https `shift_link`; all outgoing strings pass `sanitizeLabel()` (strips "Q.ai"/"UX study"/codenames)
- Session name is always "Voice Research Session" — raw position/business names are never returned
- Eligibility feature is entirely hidden unless both bookings tokens are set; endpoint rate-limited 5 req/min/IP, no PII in logs; blocked pros get remaining:0 with the SAME cap message everyone at 0 gets ("you've already hit the cap — refer a friend") — no blocked-specific copy is ever shown (isBlocked stays in the JSON for internal use only); `cap` in responses is always 3 (contract)
- Visual language (V6 "minimal pass", per attached minimal mock): white bg, plain type hierarchy + 1px #EEEEF2 dividers, no cards/chips/badges/shadows; blue #3D5AFE only for links + primary CTA; green #1E8A4C only for earnings; secondary text uses muted-foreground #5B6072 (kept ≥AA contrast — do not lighten to #8A8F9E for essential text); detail page is a key/value line list with a slim map strip
- UI is a 3-screen flow (V5, replaced the V4 wizard): Home (`/` — Research branding, confidentiality strip, hero card with "See available sessions", Before-you-book list, sign-up funnel) → Available sessions (`/sessions` — cards with date/time/pay chip `~$72`/Book same-tab https-validated, cap notice, "Check remaining spots" eligibility drawer) → Session detail (`/sessions/:id` — instructions-led by default; map variant when session has lat+lng+fullAddress: raster OSM tile StaticMap component (no iframe/WebGL), full address, Get directions to Google/Apple Maps, sticky "Complete sign-up form" CTA new tab — never "Book this session" as detail primary). Site saved in localStorage `iw_site` via use-site.ts; no location gate on load (DEFAULT_SITE key must match API site keys, e.g. `philadelphia-pa`)
- GET /api/sessions items include `fullAddress`, `latitude`, `longitude`, `neighborhoodLabel` (derived from site_label; suppressed when it matches the city or contains digits/parens — internal ops labels). Company/business names are never synced or served.
- Bookings sync stores `completed_count` and `remaining` from Mode (remaining = cap − completed − booked, 0 if blocked; computed as fallback if the Mode run lacks the column); eligibility serves the stored `remaining` and returns `completedCount`; participant_booking inserts are chunked (2000 rows) to stay under Postgres's 65,535 bind-param limit, and bookings-sync errors log message-only (DB errors can embed PII params)
- V4 frontend is a guided wizard at `/`: Intro (with 2-form sign-up funnel + "Start sign-up" → SIGNUP_FORM_URL) → Step 1 Location → Step 2 Pick a day → Step 3 Confirm & book, with a 3-step progress indicator; all screens in `src/pages/Wizard.tsx`
- Wizard state (step, site, selected session) persists in localStorage `iw_wizard_state` (+ `iw_site` mirror) via `use-wizard.ts`; refresh keeps progress; Next/Continue are gated (location resolved / day selected)
- Location resolution is fully client-side (geolocation or bundled ZIP-prefix centroids + haversine over /api/sites); nothing is sent to the server
- Frontend constants live in `src/lib/constants.ts`: SIGNUP_FORM_URL, DEFAULT_SITE (Philadelphia, PA), EXCLUDED_STATES (Texas/Washington/Illinois — drives the Step 3 amber row), SESSION_CAP (3)
- Book button validates bookUrl is https:// then opens the Instawork link in the same tab after a toast
- Sample seed rows (shift_group_id 900001+) exist so the UI isn't empty before Mode secrets are added; the first real sync replaces them

## Product

Location gate → landing (feature card, trust rows, "Before you book" requirements) → available sessions list → session detail with progress bar and sticky Book button (deep-links to Instawork). `/admin` is password-gated with manual sync + status.

## Gotchas

- Never display partner/client names, "Q.ai", "UX study", or "AI" in the UI
- Wrong `CRON_SECRET` / `ADMIN_PASSWORD` → 401 by design; sync skips (not errors) when Mode secrets are missing

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
