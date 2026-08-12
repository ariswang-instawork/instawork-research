# Per-site remaining sessions as a dedicated page

Date: 2026-08-12
Status: Approved (design)

## Summary

On `/my-sessions`, an eligible site in the Remaining tab currently expands in place
(down-chevron accordion) to reveal that business's open shifts and a Book button.
That in-card expansion should instead navigate to a dedicated page at
`/my-sessions/:businessId`. The Remaining list stays a list of sites; booking a
specific shift happens on the site page.

## Decisions (from brainstorming)

- Destination: a new route per site (`/my-sessions/:businessId`), not reuse of
  `/sessions/:id`.
- Affordance: the whole eligible card is the link, with a right-chevron (`›`)
  instead of a down-chevron. No explicit "View shifts" button.

## Scope

In scope:

- Remaining-tab eligible cards become whole-row links to `/my-sessions/:businessId`.
- New `MySessionsSite` page showing that site's remaining-session context and its
  open shifts with Book buttons.
- Route registration; analytics for the page view.

Out of scope (YAGNI):

- Any change to History-tab cards.
- Any change to the eligibility APIs or `useEligibilitySessions`.
- Making blocked / maxed-out Remaining cards into links (they stay static).

## Remaining tab

Eligible sites (`!isBlocked && remaining > 0`):

- Same card content as today (site name, "X of Y remaining", NYC one-visit note).
- Whole card is a `Link` to `/my-sessions/:businessId`.
- Right-chevron (`ChevronRight`) instead of `ChevronDown`.
- On click, fire `eligibility_site_expanded` `{ business_id }` (same event as the
  former expand action).

Blocked / `remaining <= 0` cards: unchanged, not links.

History tab: unchanged.

Drop `ExpandableEligibilitySiteCard` and the `expandedBusiness` accordion state
from `EligibilityPanel`.

## Site page (`/my-sessions/:businessId`)

New `client/src/pages/MySessionsSite.tsx`.

Layout (mirrors `MySessions`):

- Back arrow → `/my-sessions`.
- H1 = site label (or "Session site").
- Subtitle = "X of Y remaining", or the blocked copy when `isBlocked`.
- NYC one-visit note when `oneVisitLimit`.
- `SessionLimitPolicyNotice` (exported from `EligibilityPanel`).
- Shift list: loading skeletons / error ("Couldn't load shifts right now.") /
  empty ("No open shifts right now.") / date · time + Book (opens `bookUrl` in a
  new tab, fires `eligibility_shift_book_clicked`).

Data:

- `useAuthStatus` + `useEligibility(isAuthenticated)` to resolve the site by
  `businessId`.
- `useEligibilitySessions(businessId, isAuthenticated && !isBlocked)` for the
  shift list. Blocked sites skip the shift fetch and show no Book list.

States:

- Auth loading: skeleton.
- Logged out: same login prompt as `/my-sessions` (`login()` returns here).
- Invalid `businessId` (non-numeric): "Site not found" + back link.
- Eligibility loaded but no matching site: "Site not found" + back link.
- Deep-link to a blocked site: show blocked copy, no shift list.

Analytics: `my_sessions_site_page_viewed` `{ business_id }` on mount when the
param parses to a positive integer.

## Route

In `client/src/App.tsx`, register `/my-sessions/:businessId` **before**
`/my-sessions` so the param route wins in `Switch`.

## Files

- Create: `client/src/pages/MySessionsSite.tsx`
- Modify: `client/src/components/EligibilityPanel.tsx` (export the policy notice;
  eligible cards become links; remove accordion)
- Modify: `client/src/App.tsx` (route)
