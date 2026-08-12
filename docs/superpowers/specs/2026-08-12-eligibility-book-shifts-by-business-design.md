# Book eligible shifts from the eligibility drawer

Date: 2026-08-12
Status: Approved (design)

## Summary

Let a logged-in Instawork user go from "how many sessions can I still book here?"
straight to booking an actual open shift, without leaving the eligibility drawer.

Today the eligibility drawer (`EligibilityCheckDrawer` in
`client/src/components/Drawers.tsx`) shows, per business/site, how many sessions the
signed-in worker can still book ("X of Y sessions remaining", blocked state, NYC
one-visit notes). `GET /api/eligibility` returns those sites keyed by `businessId`.
But there is no link from an eligible site to that site's real open shifts — shift
browsing elsewhere is keyed by city/state (`GET /api/sessions?site=<city-state key>`),
not by `businessId`, so eligibility and booking are disconnected.

This feature closes that gap: an eligible site card in the drawer's **Overview** tab
becomes expandable, revealing that business's open shifts, each with a **Book** button
that opens the shift's Instawork deep link.

## Scope

In scope:

- Expand-in-place behavior for eligible site cards in the Overview tab.
- A new auth-required endpoint that returns a single business's open shifts.
- A minimal shift row (date · time + Book) and the direct-book action.
- Analytics for expand and book.

Out of scope (YAGNI):

- Any change to the "My sessions" tab.
- Any change to the public, unauthenticated `/api/sessions` browsing flow.
- Booking multiple shifts at once, in-app booking confirmation, or address reveal.

## Chosen interaction (from brainstorming)

- **Option A — expand in place.** Clicking an eligible site row expands it inside the
  existing drawer to show that business's open shifts. Everything stays on one surface.
- **Book opens the Instawork deep link directly** in a new tab (matches authenticated
  `SessionDetail` behavior). No intermediate detail page.
- **Minimal shift row:** date · time on the left, a blue **Book** button on the right.
  No pay/spots detail.

## Architecture & data flow

1. Drawer Overview tab renders eligibility sites (unchanged data from `/api/eligibility`).
2. A site card is **expandable only when `!isBlocked && remaining > 0`**. Blocked /
   maxed-out cards render exactly as they do today (no expansion).
3. Expanding a card sets the open `businessId` in local state and lazily fetches that
   business's open shifts via `GET /api/eligibility/sessions?business=<id>`.
4. The endpoint reuses the existing "servable" rule (upcoming, `open_shifts_count > 0`,
   not overbook, valid https link), filters to the requested `businessId`, and returns
   the rows serialized with `toPublicSessionItem` (address/coords stay hidden, same
   privacy rule as the rest of the app).
5. Each returned shift renders as a minimal row; **Book** opens `bookUrl` in a new tab.

## Server

New endpoint in `server/routes.ts`, next to `/api/eligibility`:

```
GET /api/eligibility/sessions?business=<positive integer>
```

- **Auth:** requires `req.session.accessToken`; otherwise `401 { error, reason }`
  (consistent with `/api/eligibility`).
- **Validation:** `business` must parse to a positive integer; otherwise
  `400 { error: "Missing or invalid 'business' parameter" }`.
- **Success:** `200 { businessId: number, sessions: SessionItem[] }`, where `sessions`
  is `getServableRowsForBusiness(businessId).map(toPublicSessionItem)`, sorted by the
  existing servable order (date asc, then start time asc).
- **Failure:** DB read errors return `500 { error, reason: "sessions_unavailable" }`.

New pure, unit-testable helper in `server/serving.ts`:

```ts
export async function getServableRowsForBusiness(businessId: number): Promise<ShiftGroup[]>
```

Implemented as `getServableRows()` filtered by `row.businessId === businessId`, so the
servable definition stays in exactly one place.

## Client

In `EligibilityCheckDrawer` (`client/src/components/Drawers.tsx`), Overview tab only:

- Track a single expanded business with local state
  (`const [expanded, setExpanded] = useState<number | null>(null)`); expanding one card
  collapses any other (accordion behavior).
- For eligible cards (`!isBlocked && remaining > 0`): render the existing card content
  as a button with a chevron affordance and `aria-expanded`. Toggling sets/clears
  `expanded` and fires the `eligibility_site_expanded` analytics event on open.
- Blocked / `remaining === 0` cards: unchanged, not expandable.

New hook in `client/src/hooks/use-auth.ts` (home of the other eligibility hooks):

```ts
export function useEligibilitySessions(businessId: number | null, enabled: boolean)
```

- Uses `@tanstack/react-query` with `queryKey: ["eligibility-sessions", businessId]`,
  `enabled: enabled && businessId != null`, `retry: false`.
- Raw `fetch` to `${base}api/eligibility/sessions?business=<id>` with
  `credentials: "include"` (same pattern as `useEligibility`), returning
  `{ businessId: number; sessions: SessionItem[] }`.

Expanded content states:

- **Loading:** one or two pulsing skeleton rows.
- **Loaded, non-empty:** list of minimal rows — `"{date} · {time}"` on the left, a blue
  **Book** button on the right.
- **Loaded, empty:** muted note "No open shifts right now." (covers eligible sites that
  currently have no open shifts, including history-only sites).
- **Error:** muted note "Couldn't load shifts right now."

**Book** handler:

```ts
if (session.bookUrl) window.open(session.bookUrl, "_blank", "noopener,noreferrer");
```

fired alongside the `eligibility_shift_book_clicked` analytics event.

## Analytics

Via the existing `trackEvent` (`client/src/lib/analytics.ts`):

- `eligibility_site_expanded` — `{ business_id }` (on expand open).
- `eligibility_shift_book_clicked` — `{ business_id, session_id }` (on Book click).

## Edge cases

- **Blocked / `remaining === 0`:** card not expandable; no shift list.
- **Eligible but no open shifts:** expands to "No open shifts right now."
- **Not logged in:** drawer shows the login prompt as today; endpoint returns 401.
- **Invalid/missing `business` param:** endpoint returns 400.
- **DB unavailable:** endpoint returns 500; drawer shows the error note.
- **"My sessions" tab:** unchanged.

## Testing

- Vitest unit test for `getServableRowsForBusiness`: returns only rows matching the
  businessId, and excludes overbook / zero-open / past-dated / non-https rows (mirroring
  the existing `getServableRows` contract). Follows the existing `server/*.test.ts`
  pattern (`siteCaps.test.ts`, `instaworkUser.test.ts`).
- `npm run check` is expected to still report only the pre-existing `req.headers` typing
  error in `server/routes.ts` (documented in AGENTS.md) and no new type errors.

## Files touched

- `server/serving.ts` — add `getServableRowsForBusiness`.
- `server/routes.ts` — add `GET /api/eligibility/sessions`.
- `client/src/hooks/use-auth.ts` — add `useEligibilitySessions`.
- `client/src/components/Drawers.tsx` — expandable Overview cards + shift rows + Book.
- `server/serving.test.ts` (new) — unit test for the helper.
