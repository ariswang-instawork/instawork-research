import type { Express, Request } from "express";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "./db";
import { normalizePhone, syncAll } from "./modeSync";
import {
  getServableRows,
  getSiteAggregateRows,
  getLastSyncedAt,
  getLastSyncRun,
  siteKey,
  sanitizeLabel,
  toSessionItem,
  syncRunToJson,
  eligibilityEnabled,
} from "./serving";

const CACHE_HEADER = "public, max-age=30";

function checkPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authorized(req: Request): boolean {
  const body = req.body as { password?: unknown };
  return typeof body?.password === "string" && checkPassword(body.password);
}

// --- Eligibility rate limit (in-memory, per IP) ---
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  bucket.count++;
  return bucket.count > RATE_LIMIT;
}

export function registerApiRoutes(app: Express) {
  app.get("/api/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/app-health", async (_req, res) => {
    try {
      const [rows, syncedAt, lastRun] = await Promise.all([
        getServableRows(),
        getLastSyncedAt(),
        getLastSyncRun(),
      ]);
      res.set("Cache-Control", "no-store");
      res.json({
        ok: true,
        syncedAt,
        sessionCount: rows.length,
        eligibilityEnabled: eligibilityEnabled(),
        lastSync: lastRun ? syncRunToJson(lastRun) : null,
      });
    } catch (err) {
      console.error("app-health failed:", err);
      res.status(200).json({
        ok: false,
        syncedAt: null,
        sessionCount: 0,
        eligibilityEnabled: false,
        lastSync: null,
      });
    }
  });

  app.get("/api/sites", async (_req, res) => {
    try {
      // Pin count is SUM(open_shifts_count) across ALL upcoming shift groups
      // per site, overbook included.
      const [rows, syncedAt] = await Promise.all([getSiteAggregateRows(), getLastSyncedAt()]);
      const byKey = new Map<
        string,
        {
          key: string;
          city: string;
          stateCode: string;
          label: string;
          latitude: number | null;
          longitude: number | null;
          openCount: number;
        }
      >();
      for (const row of rows) {
        if (!row.city || !row.stateCode) continue;
        const key = siteKey(row.city, row.stateCode);
        const city = sanitizeLabel(row.city);
        const stateCode = sanitizeLabel(row.stateCode);
        let entry = byKey.get(key);
        if (!entry) {
          entry = {
            key,
            city,
            stateCode,
            label: `${city}, ${stateCode}`,
            latitude: row.latitude,
            longitude: row.longitude,
            openCount: 0,
          };
          byKey.set(key, entry);
        }
        if (entry.latitude == null && row.latitude != null) {
          entry.latitude = row.latitude;
          entry.longitude = row.longitude;
        }
        entry.openCount += row.openShiftsCount ?? 0;
      }
      res.set("Cache-Control", CACHE_HEADER);
      res.json({ syncedAt, sites: Array.from(byKey.values()) });
    } catch (err) {
      console.error("sites failed:", err);
      res.json({ syncedAt: null, sites: [] });
    }
  });

  app.get("/api/sessions", async (req, res) => {
    const site = typeof req.query.site === "string" ? req.query.site.trim() : "";
    if (!site) {
      return res.status(400).json({ error: "Missing or invalid 'site' parameter" });
    }
    try {
      const [rows, syncedAt] = await Promise.all([getServableRows(), getLastSyncedAt()]);
      const matching = rows.filter((r) => siteKey(r.city, r.stateCode) === site);
      if (matching.length === 0) {
        return res.status(404).json({ error: "No sessions found for this location" });
      }
      const first = matching[0];
      const city = sanitizeLabel(first.city);
      const stateCode = sanitizeLabel(first.stateCode);
      res.set("Cache-Control", CACHE_HEADER);
      res.json({
        syncedAt,
        site: { city, stateCode, label: `${city}, ${stateCode}` },
        sessions: matching.map(toSessionItem),
      });
    } catch (err) {
      console.error("sessions failed:", err);
      res.status(404).json({ error: "No sessions available right now" });
    }
  });

  app.get("/api/sessions/:id", async (req, res) => {
    const raw = req.params.id;
    if (!raw || !/^\d+$/.test(raw)) {
      return res.status(404).json({ error: "Session not found" });
    }
    try {
      const [rows, syncedAt] = await Promise.all([getServableRows(), getLastSyncedAt()]);
      const row = rows.find((r) => String(r.id) === raw);
      if (!row) return res.status(404).json({ error: "Session not found" });
      const city = sanitizeLabel(row.city);
      const stateCode = sanitizeLabel(row.stateCode);
      res.set("Cache-Control", CACHE_HEADER);
      res.json({
        ...toSessionItem(row),
        city,
        stateCode,
        label: `${city}, ${stateCode}`,
        syncedAt,
      });
    } catch (err) {
      console.error("session detail failed:", err);
      res.status(404).json({ error: "Session not found" });
    }
  });

  // --- ZIP geocoding (server-side; cached — ZIP centroids never change) ---
  const zipCache = new Map<string, { latitude: number; longitude: number } | null>();

  app.get("/api/geocode-zip", async (req, res) => {
    const raw = typeof req.query.zip === "string" ? req.query.zip.trim() : "";
    if (!/^\d{5}$/.test(raw)) {
      return res.status(400).json({ error: "Enter a valid 5-digit ZIP code." });
    }
    try {
      let coords = zipCache.get(raw);
      if (coords === undefined) {
        const resp = await fetch(`https://api.zippopotam.us/us/${raw}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (resp.ok) {
          const body = (await resp.json()) as { places?: { latitude: string; longitude: string }[] };
          const place = body.places?.[0];
          coords = place
            ? { latitude: Number(place.latitude), longitude: Number(place.longitude) }
            : null;
        } else if (resp.status === 404) {
          coords = null; // Unknown ZIP — cacheable negative result.
        } else {
          throw new Error(`geocoder responded ${resp.status}`);
        }
        zipCache.set(raw, coords);
      }
      if (!coords || !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) {
        return res.status(404).json({ error: "Enter a valid 5-digit ZIP code." });
      }
      res.set("Cache-Control", "public, max-age=86400");
      res.json({ zip: raw, latitude: coords.latitude, longitude: coords.longitude });
    } catch (err) {
      console.error("geocode-zip failed:", err);
      res.status(502).json({ error: "Could not look up that ZIP code right now." });
    }
  });

  // --- Eligibility (no PII in logs) ---
  app.post("/api/eligibility", async (req, res) => {
    if (!eligibilityEnabled()) {
      return res.status(404).json({ error: "This feature is not available" });
    }
    const ip = req.ip ?? "unknown";
    if (rateLimited(ip)) {
      return res.status(429).json({ error: "Too many requests — try again in a minute" });
    }
    const name = req.body?.name;
    const phone = req.body?.phone;
    if (
      typeof name !== "string" ||
      name.trim().length < 1 ||
      name.length > 120 ||
      typeof phone !== "string" ||
      phone.trim().length < 7 ||
      phone.length > 30
    ) {
      return res.status(400).json({ error: "Please enter your name and phone number" });
    }
    try {
      const phoneNorm = normalizePhone(phone);
      if (phoneNorm.length !== 10) {
        return res.status(400).json({ error: "Please enter a valid 10-digit phone number" });
      }
      const bookings = await prisma.participantBooking.findMany({ where: { phoneNorm } });
      if (bookings.length === 0) {
        return res.json({
          found: false,
          completedCount: null,
          bookedCount: null,
          cap: 3,
          remaining: 3,
          isBlocked: false,
          message: "Looks like you haven't booked one yet — you can book up to 3.",
        });
      }
      // Aggregate across businesses: program cap applies to the participant.
      const completedCount = bookings.reduce((s, b) => s + b.completedCount, 0);
      const bookedCount = bookings.reduce((s, b) => s + b.bookedCount, 0);
      const isBlocked = bookings.some((b) => b.isBlocked);
      const minRemaining = Math.min(...bookings.map((b) => b.remaining ?? 3));
      const remaining = isBlocked ? 0 : Math.max(0, minRemaining);
      // isBlocked is returned for internal use only — the participant-facing
      // message never differs based on it.
      res.json({
        found: true,
        completedCount,
        bookedCount,
        cap: 3,
        remaining,
        isBlocked,
        message:
          remaining === 0
            ? "Unfortunately, you can't book more sessions — you've already hit the cap. Refer a friend who might be interested."
            : `You can book ${remaining} more session${remaining === 1 ? "" : "s"}.`,
      });
    } catch (err) {
      console.error("eligibility lookup failed:", err);
      res.status(400).json({ error: "We couldn't check right now — please try again" });
    }
  });

  // --- Admin (password protected) ---
  app.post("/api/admin/status", async (req, res) => {
    if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const [rows, syncedAt, runs] = await Promise.all([
        getServableRows(),
        getLastSyncedAt(),
        prisma.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
      ]);
      res.json({
        sessionCount: rows.length,
        siteCount: new Set(rows.map((r) => siteKey(r.city, r.stateCode))).size,
        syncedAt,
        eligibilityEnabled: eligibilityEnabled(),
        recentRuns: runs.map(syncRunToJson),
      });
    } catch (err) {
      console.error("admin status failed:", err);
      res.status(500).json({ error: "Status unavailable" });
    }
  });

  app.post("/api/admin/sync", async (req, res) => {
    if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });
    const results = await syncAll();
    const ok = results.every((r) => r.ok);
    res.json({
      status: ok ? "ok" : "error",
      message: ok ? null : results.filter((r) => !r.ok).map((r) => `${r.source}: ${r.error}`).join("; "),
      rowCount: results.reduce((s, r) => s + (r.rowCount ?? 0), 0),
      siteCount: null,
    });
  });

  // Cron endpoint — protected by x-cron-secret header, not in the OpenAPI contract.
  app.post("/api/cron/sync-mode", async (req, res) => {
    const secret = process.env.CRON_SECRET;
    const provided = req.get("x-cron-secret");
    if (!secret || !provided || provided !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const results = await syncAll();
    const ok = results.every((r) => r.ok);
    res.status(ok ? 200 : 500).json({
      status: ok ? "ok" : "error",
      message: ok ? null : results.filter((r) => !r.ok).map((r) => `${r.source}: ${r.error}`).join("; "),
      rowCount: results.reduce((s, r) => s + (r.rowCount ?? 0), 0),
      siteCount: null,
    });
  });
}
