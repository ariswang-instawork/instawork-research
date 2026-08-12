# Returning-user path: dedicated "My sessions" page + prominent landing entry

Date: 2026-08-12
Status: Approved (design)

## Summary

Most visitors are existing Instawork users, but the entry point to "see and book the
sessions I can still book" is buried: a tiny text link at the bottom of the landing
sessions section (only after a city is picked) and a "My sessions" item in the mobile
menu — both opening a bottom-sheet drawer. This feature elevates the returning-user
journey to a co-equal, first-class path:

- A compact two-choice band at the top of the landing hero: **New here → Browse** vs
  **Already booked with us → See my sessions**.
- A dedicated, deep-linkable page at **`/my-sessions`** that shows the user's remaining
  sessions and the expand-to-book flow.
- `/my-sessions` becomes the single source of truth for eligibility; the bottom-sheet
  drawer is retired and every entry point routes to the page.

## Decisions (from brainstorming)

- **Intent:** treat "returning user" as a co-equal, top-of-page path (not just a louder
  CTA, not only post-login personalization).
- **Destination:** a dedicated, deep-linkable page (`/my-sessions`), not a modal or an
  inline section.
- **Hero layout:** a compact two-choice band added *above* the existing hero browse UI;
  the current hero content (stat cards, location selector, "Book sessions near me")
  stays intact below.
- **Consolidation:** `/my-sessions` is the single eligibility surface. Retire the
  `EligibilityCheckDrawer`; point the hero card, the mobile-menu "My sessions", and a new
  desktop-header "My sessions" link all at the page.

## Scope

In scope:

- Extract the drawer's eligibility content into a reusable `EligibilityPanel` component.
- New `/my-sessions` route + `MySessions` page rendering that panel.
- Landing hero two-choice band.
- Header (desktop + mobile) "My sessions" entry points.
- Remove `EligibilityCheckDrawer` and the old landing text link.
- Analytics for the new entry points and page view.

Out of scope (YAGNI):

- Any change to the eligibility API endpoints (`/api/auth/status`, `/api/eligibility`,
  `/api/eligibility/sessions`) — all unchanged.
- Any change to the expand-to-book behavior itself (already shipped).
- `LocationDrawer` — untouched; still used by the location selector.

## Architecture & data flow

Refactor-then-add:

1. **Extract** the inner content of `EligibilityCheckDrawer` into a new, container-free
   `EligibilityPanel` component (auth gating, tabs, policy notice, expandable cards,
   loading/empty/error/logged-out states). Behavior is byte-for-byte the same as today;
   only the surrounding chrome changes.
2. **Add** a `MySessions` page that renders `<EligibilityPanel />` full-page, and a
   `/my-sessions` route.
3. **Repoint** every entry point (hero card, mobile menu, new desktop link) to navigate
   to `/my-sessions`.
4. **Retire** `EligibilityCheckDrawer` and remove its usages from `Shell` and `Landing`.

Data flow is unchanged: the panel calls the same hooks (`useAuthStatus`,
`useEligibility`, `useEligibilitySessions`) hitting the same endpoints.

## Components

### `EligibilityPanel` (`client/src/components/EligibilityPanel.tsx`, new)

- Container-free; renders the eligibility content and manages its own local state
  (`tab`, `expandedBusiness`).
- Moves `SessionLimitPolicyNotice` and `ExpandableEligibilitySiteCard` out of
  `Drawers.tsx` into this file (they are only used here).
- States:
  - **auth loading:** skeleton rows.
  - **logged out:** value-prop copy + a "Log in with Instawork" button calling `login()`
    (which stores the current path; OAuth returns to `/my-sessions`).
  - **logged in:** two tabs — **"Remaining"** (was "Overview": expandable eligible
    cards + blocked/maxed static cards) and **"History"** (was "My sessions": booked /
    completed / remaining breakdown). Loading / error / empty states carry over verbatim.
- Tab rename ("Overview"→"Remaining", "My sessions"→"History") avoids clashing with the
  page name.

### `MySessions` page (`client/src/pages/MySessions.tsx`, new)

- Layout: back arrow to `/`, `max-w` centered container, H1 **"Your sessions"**, subtitle
  "Based on your Instawork account.", then `<EligibilityPanel />`.
- Fires `my_sessions_page_viewed` on mount (via `trackEvent`).

### Route (`client/src/App.tsx`)

- Add `<Route path="/my-sessions" component={MySessions} />`.

### Landing hero two-choice band (`client/src/pages/Landing.tsx`)

- A slim band directly under the headline/benefit badges, above the `LocationSelector`.
- Two choices, existing hero content preserved below:
  - **"New to research sessions?" → "Browse sessions"** — calls the existing
    `handleSeeSessions()` (focuses the picker if no city, else scrolls to sessions);
    fires `new_user_path_clicked`.
  - **"Already booked or completed a session?" → "See my sessions"** — `setLocation("/my-sessions")`;
    fires `returning_user_path_clicked`.
- Remove the old bottom-of-sessions text link (the `hasCity && (...) Check remaining
  sessions` block) and the now-unused local `eligibilityOpen` state + the
  `<EligibilityCheckDrawer .../>` render in `Landing`.

### Header / nav (`client/src/components/layout/Shell.tsx`)

- Desktop nav: add a persistent **"My sessions"** button → `go("/my-sessions")`, placed
  before "Log in/Log out".
- Mobile menu: change the **"My sessions"** item's action from opening the drawer to
  `go("/my-sessions")`.
- Remove the `EligibilityCheckDrawer` import, the `eligibilityOpen` state, and the
  drawer render from `Shell`.

### Retire the drawer (`client/src/components/Drawers.tsx`)

- Delete the `EligibilityCheckDrawer` export and the two helpers moved to
  `EligibilityPanel` (`SessionLimitPolicyNotice`, `ExpandableEligibilitySiteCard`).
- Keep `LocationDrawer` and its imports intact. Prune now-unused imports
  (`useAuthStatus`, `useEligibility`, `useEligibilitySessions`, `login`,
  `EligibilitySite`, `trackEvent`, `ChevronDown`, `PrimaryCtaButton`, drawer-only
  subcomponents) only if they are no longer referenced by `LocationDrawer`.

## Analytics

Via existing `trackEvent`:

- `my_sessions_page_viewed` — on `MySessions` mount.
- `returning_user_path_clicked` — hero "See my sessions".
- `new_user_path_clicked` — hero "Browse sessions".
- Unchanged (moved with the component): `eligibility_site_expanded`,
  `eligibility_shift_book_clicked`.

## Edge cases

- **Deep link to `/my-sessions` while logged out:** page renders the login prompt;
  `login()` returns the user to `/my-sessions` after OAuth.
- **Auth still loading:** skeleton, no flash of the logged-out prompt.
- **Eligibility error / empty:** same messages as the current drawer.
- **Back navigation:** page back arrow → `/`.
- **`LocationDrawer`:** unaffected.

## Testing

- `npm run check` — no NEW type errors (the pre-existing `req.headers` error in
  `server/routes.ts` remains, per AGENTS.md).
- `npm run build` — succeeds.
- Manual (headless-verifiable): `/my-sessions` renders the logged-out prompt; the hero
  band renders and its two actions navigate/scroll correctly; desktop + mobile "My
  sessions" navigate to the page; the old drawer no longer mounts.
- The logged-in eligibility content is unchanged from the shipped drawer and requires a
  real Instawork OAuth session to exercise (cannot be completed headlessly per AGENTS.md).

## Files touched

- Create: `client/src/components/EligibilityPanel.tsx`
- Create: `client/src/pages/MySessions.tsx`
- Modify: `client/src/App.tsx` (route)
- Modify: `client/src/pages/Landing.tsx` (hero band; remove old link + drawer)
- Modify: `client/src/components/layout/Shell.tsx` (nav links; remove drawer)
- Modify: `client/src/components/Drawers.tsx` (remove `EligibilityCheckDrawer` + moved helpers)
