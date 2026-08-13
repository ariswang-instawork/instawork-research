# Minimal landing page

Date: 2026-08-13
Status: Approved (design)

## Summary

Strip the landing hero to a single focused action. Available sessions appear only
after the user clicks "Find sessions near me". Keep Explore other locations (map)
and FAQ below.

## Hero (kept)

- Eyebrow "Instawork Research"
- Headline + subline
- Location selector
- One primary button: "Find sessions near me"
- Small text link: "Already booked with us? See my sessions" → `/my-sessions`

## Hero (removed)

- Stat cards (estimated pay, 500+ completed)
- Benefit badges (In-person, 3 hours)
- Two-choice band cards
- Right-column image placeholder
- Excluded-states disclaimer (removed from hero for minimalism)

## Available sessions

- Hidden until user clicks "Find sessions near me"
- No city → open location picker (unchanged)
- City selected → reveal section + scroll into view
- Reset hidden state when city changes
- Same session row list (SessionCard)

## Kept below

- Explore other locations (map)
- FAQ

## Page order

1. Minimal hero
2. Available sessions (conditional)
3. Explore other locations
4. FAQ
