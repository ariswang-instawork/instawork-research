---
name: Leaflet mobile map card
description: Lessons from the landing-page Leaflet map (fitBounds sizing, zoomSnap, DivIcon labels)
---

- Call `map.invalidateSize()` **before** `fitBounds` (same rAF), or bounds are computed against a stale container and pins land off-screen.
- **Why:** the map card mounts inside a flex layout; Leaflet caches container size at mount.
- Default integer `zoomSnap` makes a US-wide fitBounds drop a whole zoom level on narrow mobile cards — set `zoomSnap: 0.25` so the country fills the card.
- DivIcon badge labels need per-site placement (left/right/above/below with edge-aware alignment) or northeast cities (Boston/NY/Philly) collide and clip at the map edge.
- Always HTML-escape API-sourced text interpolated into `L.divIcon({ html })` — it goes through innerHTML.
- `/api/sites` `label` is always "City, ST" (safe); internal Mode ops labels (digits/parens) are filtered server-side and never served.
