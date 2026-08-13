# Landing page trust layer: intro, rolling testimonials, and tips

## Goal

Increase first-visit trust on the landing page (`client/src/pages/Landing.tsx`) by:

1. Removing the "Explore other locations" map section (its per-city "N openings"
   counts visually competed with the actual shift times).
2. Adding a short "What a research session is" intro so a first-time visitor
   immediately understands the offer.
3. Adding a **rolling** (auto-scrolling marquee) wall of real 5★ Instawork Pro
   quotes as social proof.
4. Adding a quiet "What to know before you book" tips section using longer
   pro comments.

All content is **static** (curated real quotes supplied by the team) — no
backend, no Mode sync. It lives in a single editable data module so it can later
be swapped for a Mode-sourced dataset without touching the UI.

## Section order (top → bottom)

Hero (unchanged) → **What a session is** → *Available sessions* (unchanged;
still revealed only after a search) → **Pros rate these sessions 5★** (rolling
marquee) → **What to know before you book** (tips) → FAQ (unchanged).

The intro, testimonials, and tips are always visible (not gated behind search),
so first-time visitors see the trust layer immediately.

## Components & files

### `client/src/lib/testimonials.ts` (new)
Static data, no dependencies.

```ts
export interface Testimonial { name: string; city: string; rating: 5; quote: string; }
export interface BookingTip { name: string; city: string; tip: string; }
export const TESTIMONIALS: Testimonial[];  // 8 headline quotes, 2 per city
export const BOOKING_TIPS: BookingTip[];    // 4 longer prep tips
```

Headline set (2 per city, all 5★):
- Raymond · San Diego — "Everyone there was very nice and inviting."
- Joseph · San Diego — "Easy and very organized."
- Shouvik · Santa Clara — "Straightforward — follow their instructions and you'll be good."
- Ma. Linda · Santa Clara — "Team always helps when you need one."
- Ilaura · NYC — "Very well organized and efficient staff. Friendly group."
- Demarco · NYC — "Really simple & easy — I recommend."
- Omar · Boston — "Nice easy shift. Staff are very polite and show hospitality."
- Valentin · Boston — "Great people to work for, and the job is pretty easy."

Booking tips (attributed advice, first name + city):
- Kyana · San Diego — "If your room is too cold, you can request a heater. If you tire easily, don't book these back to back."
- Aushanai · San Diego — "Parking is validated — arrive early and bring a jacket."
- Tavaria · NYC — "Repetitive but easy; coffee and snacks are provided."
- Janel · NYC — "Easy work — stay alert, it's a lot of reading and speaking."

Only first names are shown in the UI (privacy). The data file keeps enough to
edit later.

### `client/src/components/TestimonialMarquee.tsx` (new)
- Renders the headline testimonials as **two rows** of cards. Row 1 scrolls
  left, row 2 scrolls right, looping seamlessly (each row's content is rendered
  twice back-to-back and animated by -50% for a seamless loop).
- Pure CSS keyframes (no carousel library). Duration ~40–60s per loop.
- **Pause on hover and on keyboard focus.**
- Soft fade gradient masks on the left/right edges (CSS mask-image) to imply
  infinite roll.
- **Accessibility:** under `prefers-reduced-motion: reduce`, animation is
  disabled and cards render as a normal wrapped/`flex-wrap` grid. Cards are
  plain text (readable by screen readers); the region has an accessible label.
- Card: white, `rounded-[14px]`, `border border-[#EEE9DD]`, `px-5 py-4`,
  min/max width so text stays legible; five amber stars, quote in navy
  `#11243e`, muted `— {name} · {city}` in `#8A93A0`.

### `client/src/pages/Landing.tsx` (edit)
- Delete the entire "Explore other locations" `<section>` (and the now-unused
  `SiteLeafletMap` import if it is used nowhere else — verify first; the map is
  still used elsewhere, e.g. session flows, so only remove the import if truly
  unused).
- Add the three new sections in the order above, using the existing
  `SECTION_HEADING` scale for headings and existing color tokens.
- Intro copy:
  > A research session is a paid, in-person appointment where you read short
  > voice prompts out loud to help improve AI. No experience needed — you'll get
  > simple instructions on site.
  Facts row: `Paid via Instawork · ~3 hours · Simple voice tasks` (small line
  icons: dollar / clock / mic from lucide-react).
- Testimonials header: "Pros rate these sessions 5★" with muted subline
  "5★ average from Instawork Pros".
- Tips header: "What to know before you book".

## Analytics
Fire existing-style `trackEvent` calls: `testimonials_viewed` (once, when the
marquee scrolls into view) and `booking_tips_viewed`. No new analytics library.

## Out of scope (YAGNI)
- No per-city filtering of the marquee (show all 8 mixed).
- No backend/Mode sync for reviews (static file only).
- No changes to `/admin`, session detail, or the booking flow.
- No changes to the map component itself (only its use on the landing page is
  removed).

## Success criteria
- Landing page no longer shows the "Explore other locations" map.
- A trust intro appears under the hero and is always visible.
- Two rows of 5★ quote cards auto-scroll in opposite directions, pause on
  hover/focus, and fall back to a static grid under reduced-motion.
- A tips section renders the four prep quotes.
- `npm run build` succeeds; no unused-import or type errors introduced.
