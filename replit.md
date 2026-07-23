# Instawork OAuth App

## Phase 1 Backend (Mode data sync)
- **Stack:** Express (TS) + Prisma + Replit Postgres (`DATABASE_URL`). Prisma pinned to v6 (v7 requires prisma.config.ts/driver adapters).
- **Models** (`prisma/schema.prisma`): `shift_group`, `participant_booking` (unique `[phone_norm, business_id]`), `sync_run`.
- **Sync** (`server/modeSync.ts`): Mode Analytics workspace `instawork` (override via `MODE_WORKSPACE`). Juicebox pattern — latest succeeded report run → matching query run → `results/content.json`. HTTP Basic (`MODE_API_TOKEN`/`MODE_API_SECRET`), 10s timeout, 2 retries. Replace-all inside a transaction with a 0-valid-row guardrail (never wipes on failure). Bookings rows without a 10-digit phone or valid business_id are skipped. Runs on boot + `POST /api/cron/sync-mode` (requires `x-cron-secret` header matching `CRON_SECRET`).
- **API** (`server/apiRoutes.ts`, shapes match `attached_assets/instawork-research-project/lib/api-spec/openapi.yaml`): `GET /api/healthz`, `GET /api/app-health`, `GET /api/sites` (per-site open counts, overbook included), `GET /api/sessions?site=<key>` (servable = upcoming, open > 0, not overbook, valid https link), `GET /api/sessions/:id`, `GET /api/geocode-zip?zip=`, `POST /api/eligibility {name, phone}` (rate-limited 5/min/IP, aggregates across businesses, cap 3), `POST /api/admin/status` + `POST /api/admin/sync` (password = `ADMIN_PASSWORD` secret), `POST /api/cron/sync-mode` (`x-cron-secret` = `CRON_SECRET`).
- **Serving helpers** (`server/serving.ts`): `sanitizeLabel` strips internal codenames (Q.ai / UX Study) from all UI-bound strings; `siteKey` = slugified `city-state`; `toSessionItem` formats dates/times/pay labels. Prior project in `attached_assets/instawork-research-project/` is the reference.
- **Frontend** (`client/src`): ported from the uploaded prior project's `research-sessions` app — Landing (Leaflet map with per-site open counts), Sessions, SessionDetail, Admin (password gate) pages via wouter. API access through the orval-generated react-query client at `client/src/lib/api-client` (was `@workspace/api-client-react`). Tailwind v4 via `@tailwindcss/vite` (no tailwind.config/postcss files); `react-leaflet@4` (v5 needs React 19); calendar.tsx kept at react-day-picker v8 API. Old OAuth UI backed up in `.local/backup/oauth-client-src` (its server routes remain in `server/routes.ts`).

## Overview
A web application that implements OAuth 2.0 Authorization Code Flow with Instawork. Users can authenticate with their Instawork account and view their profile data.

## Architecture
- **Frontend**: React + Vite with Tailwind CSS and shadcn/ui components
- **Backend**: Express.js with session-based token storage
- **Routing**: wouter (frontend), Express (backend)
- **State Management**: TanStack React Query

## OAuth Flow (with PKCE)
1. User clicks "Connect with Instawork" button
2. Backend generates a PKCE `code_verifier` and its SHA-256 `code_challenge`, stores verifier in session
3. Browser redirects to Instawork's `/oauth2/authorize/` with `code_challenge` and `code_challenge_method=S256`
4. User consents on Instawork's page
5. Instawork redirects back to `/api/auth/callback?code=...&state=...`
6. Backend validates state, then exchanges the code for an access token via `POST /oauth2/token/` including the `code_verifier`
7. Token is stored in the server-side session
8. Frontend calls `GET /api/users/me` which proxies to Instawork's API
9. User profile data is rendered on the page

## Environment Variables
- `INSTAWORK_CLIENT_ID` (secret) - OAuth client ID
- `INSTAWORK_CLIENT_SECRET` (secret) - OAuth client secret
- `SESSION_SECRET` (secret) - Express session encryption key
- `INSTAWORK_BASE_URL` (env) - Base URL for Instawork API (default: http://localhost:8080)

## Key Files
- `server/routes.ts` - Backend OAuth routes and API proxy
- `client/src/pages/home.tsx` - Main page with login/profile UI
- `client/src/App.tsx` - App router setup

## API Endpoints
- `GET /api/auth/login` - Returns Instawork authorize URL
- `GET /api/auth/callback` - OAuth callback, exchanges code for token
- `GET /api/auth/status` - Returns authentication status
- `GET /api/auth/logout` - Destroys session
- `GET /api/users/me` - Proxies to Instawork's user profile API
