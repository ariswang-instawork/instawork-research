# My sessions — minimal Apple-style redesign

## Goal

Make the authenticated `/my-sessions` experience feel like a desktop web app
(not a mobile screen) and pare it down to a clean, content-first layout inspired
by Apple's Human Interface principles (clarity, deference, depth). Also make the
copy user-facing and personal.

## Changes

### 1. Copy: "Your sessions" → "My sessions"

The header nav link already says "My sessions"; the page title said "Your
sessions". Rename the page title (and the returning-user context) to **"My
sessions"** so the clicked label matches the destination.

### 2. Personal greeting from OAuth

- Backend already exposes `GET /api/me` → `{ workerId, name }` (resolved from
  Instawork `/api/users/me/`). No backend change needed.
- Add a client hook `useMe(enabled)` in `client/src/hooks/use-auth.ts` that
  fetches `/api/me` when authenticated.
- On the page, show the user's **first name** as a quiet, muted secondary line
  **below** the title: _"Welcome back, {firstName}."_
- Graceful degradation: if the name is missing or the request fails, hide the
  greeting entirely (never show "Welcome back, ." or a broken state).

### 3. Navigation: Home link, no in-page back arrow

- Remove the in-page "← Back to home" / "← Back to your sessions" arrows — a
  mobile push/pop pattern that doesn't fit a top-level desktop destination.
- Add a **"Home"** link to the header nav so navigation lives in one place:
  `Home · My sessions · Log out` (My sessions only shown when authenticated,
  per existing behavior).
- The site detail page (`/my-sessions/:businessId`) keeps a lightweight text
  link back to `/my-sessions` (it IS a drill-down), styled quietly without a
  heavy arrow button.

### 4. Minimal page layout (Apple-style)

- **Container:** single readable column, `max-w-[720px]`, centered, generous
  vertical padding. Drop the two-column card grid.
- **Large title:** big bold "My sessions" (42px scale) with lots of air; muted
  gray greeting line directly beneath.
- **Tabs:** Remaining / History as quiet text tabs — active tab in blue with a
  thin short underline; inactive muted gray. Full-width hairline beneath.
- **Policy note:** replace the filled blue "How session limits work" panel with
  one incidental line of tertiary text + a small info icon:
  _"Most sites allow 3 sessions; New York allows 1 visit."_
- **Site list (grouped, iOS-Settings style):** replace bordered cards with a
  single subtly-rounded white container; tall comfortable rows separated by
  inset hairline dividers. Each row: site name (bold navy) + remaining count
  (muted gray) on the left, right-facing chevron on the right. Blocked/maxed-out
  sites stay non-clickable and show their status inline (amber only where it
  carries meaning).
- **History tab:** same grouped-list container; each row shows Booked /
  Completed / Remaining as quiet label–value pairs.
- **One accent:** blue used only on the active tab and chevrons. Hierarchy comes
  from size and weight, not boxes.

### 5. Site detail page

Apply the same container width, large title, muted secondary line, quiet policy
note, and grouped-list treatment (shift rows with a Book action) so the two
pages feel consistent.

## Out of scope

- No changes to eligibility logic, endpoints, or booking behavior.
- No new OAuth scopes (name already returned by `/api/me`).

## Success criteria

- Page reads as a desktop web app: wide container, large title, whitespace.
- Greeting shows the logged-in user's first name, or nothing if unavailable.
- Header shows Home; no in-page back arrow on the top-level page.
- Site list is a grouped hairline list, not filled cards; policy note is one
  quiet line.
- `npm run build` passes.
