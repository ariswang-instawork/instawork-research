---
name: Uploaded artifact markers break publishing
description: Why a publish failed even though the app's own build passed
---

Uploaded/reference projects that contain `.replit-artifact/artifact.toml` directories get auto-registered as artifact services, and publishing tries to build them — a failing reference build fails the whole publish.

**Why:** A monorepo uploaded into `attached_assets/` (never part of the app) failed its own build (`esbuild-plugin-pino` missing) and blocked publishing on 2026-07-30.

**How to apply:** If publish fails but `npm run build` passes, check for stray `.replit-artifact` dirs or `.replit` files inside uploaded folders and remove the markers (keep the code). Removing them also removes the phantom failing workflows.
