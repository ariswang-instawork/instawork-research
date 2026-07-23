---
name: Mode Analytics API quirks
description: Lessons syncing Mode report data via API keys in this project
---

- Mode API keys cannot call `GET /api/account` (400 "unsupported for Api Keys"). The workspace name cannot be discovered from the token; this project's workspace is `instawork` (override via `MODE_WORKSPACE` env).
- Working fetch pattern: list report runs, take latest `state === "succeeded"`, list its query_runs, match `query_token`, then GET `.../results/content.json` (rows may be top-level array or `.rows`).
- **Why:** avoids triggering fresh report runs (slow, needs run permissions) and mirrors the Juicebox pattern requested by the user.
- Bookings dataset is ~110k rows; replace-all works fine as one Prisma transaction with `createMany` in 5k chunks and a raised `timeout` (~12s total). Guardrail must check the *post-validation/dedupe* count, not raw fetch length.
- Prisma 7 broke `url = env(...)` in schema files; project pins prisma@6 + @prisma/client@6.
- Frontend port pitfalls: the prior project's UI needs Tailwind v4 (`@tailwindcss/vite`, no config files), react-leaflet must stay at v4 under React 18 (v5 needs React 19), and its calendar.tsx targets react-day-picker v9 — keep the v8-compatible version since this project pins v8.
- API contract lives in the uploaded prior project (`attached_assets/instawork-research-project/lib/api-spec/openapi.yaml`); user chose to keep the Prisma backend but match that spec (/sites, /sessions, /eligibility, /admin/*). Public responses must pass `sanitizeLabel` (never leak "Q.ai" / "UX Study" codenames); eligibility never echoes name/phone and messages must not differ for blocked users.
