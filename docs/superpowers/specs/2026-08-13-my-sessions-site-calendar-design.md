# Site detail page: calendar view for available sessions

## Goal

On `/my-sessions/:businessId` (e.g. clicking into "Philadelphia 1" from My
sessions), replace the flat list of every open shift with a **calendar**: a
month grid highlighting which days have open sessions, and a time-slot list
for the selected day underneath. This collapses multi-session days (e.g. two
Friday slots) into a single dot and makes "which days have openings" scannable
at a glance.

## Data

No backend change needed. `GET /api/eligibility/sessions?business=<id>`
already returns every open, servable session for the site in one response
(`EligibilitySessionsResponse.sessions: SessionItem[]`), each with a real
`dateISO` (`YYYY-MM-DD`) and `time` (e.g. "8:30 AM – 11:30 AM"). The calendar
is built entirely client-side from this existing payload — group sessions by
`dateISO`.

## Component

New component `client/src/components/SessionCalendar.tsx`:

```
<SessionCalendar
  sessions={SessionItem[]}
  onBook={(session: SessionItem) => void}
/>
```

Internally:

- Group `sessions` into a `Map<dateISO, SessionItem[]>`.
- Track `viewMonth` (year+month currently displayed) and `selectedDate`
  (dateISO string | null) as local state.
- **Initial state:** `viewMonth` = the month of the soonest date with
  sessions; `selectedDate` = that soonest date (the default answer from the
  design discussion — guides the user straight to the next opportunity to
  book).
- If `sessions` is empty, render the existing "No open shifts right now."
  message instead of an empty calendar (no regression from today).

### Month grid

- Header row: `‹` / `›` chevron buttons + "{Month} {Year}" label, matching the
  site's minimal hairline aesthetic (white rounded `[14px]` card, border
  `#EEE9DD`, no heavy chrome).
- 7-column grid, weekday abbreviations (Sun–Sat) as a header row.
- Each day cell:
  - **Has sessions:** dark navy day number, small blue dot beneath it,
    clickable (sets `selectedDate`).
  - **No sessions (including past days / days outside the data range):**
    muted gray day number, no dot, not clickable (`disabled`, no hover state).
  - **Selected day:** soft blue rounded background (`bg-[#3351E6]/10`), bold
    blue day number.
  - Days outside the current `viewMonth` (leading/trailing blanks) render as
    empty cells, consistent with typical calendar grids.
- **Month navigation range:** bounded to the min/max `dateISO` month present
  in `sessions`. The `‹`/`›` buttons are disabled past that range (no fetching
  more data — everything is already loaded). If a site only has sessions in
  one month, both arrows render disabled.

### Selected-day list

- Small muted label above the list: the selected date spelled out (e.g.
  "Friday, August 14").
- Reuses the existing time-slot row treatment already on this page: white
  rounded `[14px]` container, hairline dividers, bold navy time range on the
  left, blue "Book" button on the right — calling the existing `onBook`
  handler (same tracking + `window.open(bookUrl)` behavior already in
  `MySessionsSite.tsx`, unchanged).
- If a day has zero sessions somehow selected (shouldn't happen since only
  dotted days are clickable), fall back to "No sessions this day."

## Page integration

In `client/src/pages/MySessionsSite.tsx`, replace the current flat
`sessions.map(...)` divided-list block with:

```tsx
<SessionCalendar sessions={sessions} onBook={handleBook} />
```

where `handleBook` is the existing inline booking handler (tracking + open
URL), extracted to a named function so it can be passed down instead of
inlined in JSX.

All existing loading/error/empty states above the calendar (auth loading,
eligibility loading/error, blocked site, no-shifts-at-all) are unchanged.

## Styling

Matches the established design language from the last two redesigns on this
page: warm off-white background, navy (`#11243e`) text, one blue (`#3351E6`)
accent used sparingly (selected day, dots, Book buttons, active affordances),
`#EEE9DD` hairlines, `#576270` muted secondary text, `[14px]` rounded corners,
no heavy filled panels.

## Out of scope

- No timezone handling beyond what `dateISO`/`time` already encode (unchanged
  from today).
- No multi-month lazy-loading — the existing single eligibility-sessions
  fetch already returns the full servable window.
- No changes to booking behavior, tracking events, or the `/api/eligibility/*`
  endpoints.

## Success criteria

- Visiting a site's page shows a month calendar with dots on days that have
  open sessions; the soonest such day is pre-selected.
- Selecting a different dotted day updates the time-slot list below it.
- Days without sessions are visually muted and non-interactive.
- Month arrows are disabled outside the range of months present in the data.
- Booking a slot still tracks `eligibility_shift_book_clicked` and opens
  `bookUrl` exactly as before.
- `npm run build` passes.
