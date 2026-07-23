---
name: Mode API sync
description: Gotchas for syncing report/query data from the Mode Analytics API
---

- Mode `_links` hrefs can be absolute URLs. Always resolve with `new URL(href, "https://app.mode.com")` and reject non-`app.mode.com` hosts before fetching with Basic-auth headers (SSRF/credential-leak guard). Naive `base + href` concatenation produced `app.mode.comhttps://...` → ENOTFOUND.
- The runs list from `/queries/{token}/runs` is not guaranteed newest-first; sort by `created_at` desc before picking the latest `state === "succeeded"` run.
- Fetch chain: runs list → run's `_links.result` → result's `_links.content` (JSON or CSV). Content may be `{columns, rows}` or an array.
- **Why:** discovered while building the Instawork Research sessions sync; curl worked but server fetch failed until the URL-join bug was fixed.
- **How to apply:** any future Mode integration in this project should reuse `artifacts/api-server/src/lib/modeSync.ts` patterns.
