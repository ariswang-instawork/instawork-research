# Consistent minimal styling across Session Detail, Get the app, and Landing

## Goal

Extend the minimal, hairline-list, quiet-copy visual language established by
the My sessions redesign (and used by Landing/Explore/FAQ already) to the
remaining consumer-facing pages, so the whole app reads as one consistent
design system. The color palette is **already consistent** across the app —
`hsl(var(--border))`/`text-muted-foreground`/`bg-primary` in `index.css`
resolve to the same hex values (`#EEE9DD`, `#576270`, `#3351E6`, `#11243e`,
`#FCFBF9`) used elsewhere. The inconsistency is layout **weight**: bordered/
shadowed cards, icon rows, and numbered circles vs. the newer flat hairline-
list treatment.

**Explicitly out of scope:** `/admin`. It's an internal staff dashboard, not
part of the consumer experience — no changes.

## 1. Session Detail (`client/src/pages/SessionDetail.tsx`)

- **Header:** title scales `28px → 36px → 42px` (site-wide heading scale,
  replacing the flat `32px`), with the site label + distance as a muted
  `16px` line beneath. The estimated-pay pill moves from the current wide
  header row to sit under the subline (or stays side-by-side on wider
  screens) — a bold navy pill on a very light tint, `$X/hr × Y hours` as a
  tiny muted line beneath it.
- **Drop the bordered/shadowed desktop card** (`md:bg-card md:border ...
  md:shadow-...`). Content sits directly on the page background, same as My
  sessions and Landing.
- **Detail rows (Calendar/MapPin/Mic/CreditCard):** keep the icons, but move
  them into a single grouped hairline-list container (`rounded-[14px] border
  border-[#EEE9DD] bg-white divide-y divide-[#EEE9DD]`, `px-5 py-4 md:py-5`
  per row) — same container component visually already used for shift lists
  elsewhere.
- **"Important to know":** collapse the bulleted list into one quiet
  paragraph-style note with a small info icon (same tone/weight as
  `SessionLimitPolicyNotice` on My sessions), not a filled/bulleted box.
- **"How booking works":** keep the 3 numbered steps, but lighten them —
  smaller number badges, no heavy card behind them, hairline dividers
  between steps instead of implicit spacing only.
- **Bottom CTA bar:** unchanged functionally (sticky, "Book in the Instawork
  app", opens `ContinueWithInstaworkSheet` or `bookUrl` as today).
- No changes to data fetching, tracking events, or the booking flow.

## 2. Get the app (`client/src/pages/GetApp.tsx`)

- Replace the filled `bg-[#FCFBF9] rounded-[16px] p-6...` "Why download the
  app?" panel with a plain quiet list: heading + checkmark rows on the plain
  page background (or a hairline-bordered white container, no fill/tint) —
  same visual weight as the policy note pattern.
- App Store / Google Play buttons keep their current card styling (they are
  functional link targets, not informational chrome — lower priority to
  touch, no change needed unless it looks inconsistent once the panel above
  it is lightened).
- No functional/tracking changes.

## 3. Landing — Available sessions becomes a calendar

- In `client/src/pages/Landing.tsx`, the "Available sessions near {city}"
  section currently renders a flat list of up to `INITIAL_SESSION_COUNT` (6)
  `SessionCard`s with a "View more sessions (N)" reveal button.
- Replace this with `<SessionCalendar sessions={sessions} onBook={...} />`
  (the same component built for the My sessions site-detail page).
- `onBook` wires to the existing `handleViewSession(session)` — navigates to
  `/sessions/:id` (this is "view details first", not a direct booking action
  like the eligibility-gated site page).
- **`SessionCalendar` gets a new optional prop** `actionLabel?: string`
  (default `"Book"`) so Landing can pass `actionLabel="View session"` to
  match existing landing copy/semantics — booking on Landing is not final
  until the user continues in the session-detail page.
- Remove now-unused Landing state/logic: `showAll`, `hiddenCount`,
  `visibleSessions`, `INITIAL_SESSION_COUNT`, the "View more sessions" button,
  and the `see_more_sessions_clicked` tracking call (no longer applicable —
  the calendar shows all dates, selecting a day shows that day's times).
- The empty states (`!hasCity`, `sessions.length === 0`, loading skeleton)
  are unchanged.
- **"Explore other locations" map is untouched**, stays below as today —
  confirmed with the user: the map (discover other cities) and the calendar
  (when can I go to *this* city) serve different purposes and both stay.

## Success criteria

- Session Detail, Get the app, and Landing share the same visual language as
  My sessions: `#FCFBF9` background, `#11243e`/`#576270` text, `#3351E6`
  accent used sparingly, `#EEE9DD` hairlines, grouped hairline lists instead
  of bordered/shadowed cards, quiet single-line notes instead of filled
  panels.
- Landing's session list is a calendar identical in structure to the site
  detail page's, with "View session" instead of "Book" as the per-slot action
  and no more list pagination.
- Booking flows (session detail bottom CTA, landing "View session" → detail
  page) are functionally unchanged — same tracking events, same URLs opened.
- Admin is untouched.
- `npm run check` and `npm run build` pass.
