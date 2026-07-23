---
name: Bulk insert limits & PII-safe error logs
description: Postgres bind-param limit on Drizzle bulk inserts, and why DB errors must not be logged whole in PII pipelines
---

**Rule 1:** Chunk Drizzle bulk inserts (e.g. 2000 rows) — Postgres caps a statement at 65,535 bind parameters. A wide table × thousands of rows silently crosses the limit when columns are added later.
**Why:** Adding 2 columns to the participant-bookings sync pushed 9k rows × 9 cols past the limit and the nightly sync started failing.

**Rule 2:** In sync/error handlers for tables holding PII, log only `err.message`, never the full `err` object.
**Why:** Drizzle/pg errors embed the full query parameter array — the failed insert dumped thousands of names and phone numbers into workflow logs.

**How to apply:** Any `tx.insert(...).values(bigArray)` → chunk it; any `logger.error({ err })` near PII data → replace with message-only logging.
