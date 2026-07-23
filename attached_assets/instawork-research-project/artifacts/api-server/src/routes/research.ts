import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, participantBookingsTable } from "@workspace/db";
import {
  GetSessionsQueryParams,
  CheckEligibilityBody,
} from "@workspace/api-zod";
import {
  getServableRows,
  getSiteAggregateRows,
  getLastSyncedAt,
  getLastSyncRun,
  siteKey,
  toSessionItem,
  syncRunToJson,
} from "../lib/serving";
import { sanitizeLabel } from "../lib/sanitize";
import { eligibilityEnabled, normalizePhone } from "../lib/modeSync";

const router: IRouter = Router();

const CACHE_HEADER = "public, max-age=30";

router.get("/app-health", async (req, res): Promise<void> => {
  try {
    const rows = await getServableRows();
    const syncedAt = await getLastSyncedAt();
    const lastRun = await getLastSyncRun();
    res.set("Cache-Control", "no-store");
    res.json({
      ok: true,
      syncedAt,
      sessionCount: rows.length,
      eligibilityEnabled: eligibilityEnabled(),
      lastSync: lastRun ? syncRunToJson(lastRun) : null,
    });
  } catch (err) {
    req.log.error({ err }, "app-health failed");
    res.status(200).json({
      ok: false,
      syncedAt: null,
      sessionCount: 0,
      eligibilityEnabled: false,
      lastSync: null,
    });
  }
});

router.get("/sites", async (req, res): Promise<void> => {
  try {
    // Aggregation rows include overbook + zero-count groups: the pin count
    // is SUM(open_shifts_count) across ALL upcoming shift groups per site.
    const rows = await getSiteAggregateRows();
    const syncedAt = await getLastSyncedAt();
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
      entry.openCount += row.openShiftsCount;
    }
    res.set("Cache-Control", CACHE_HEADER);
    res.json({
      syncedAt,
      sites: [...byKey.values()].map((s) => ({
        key: s.key,
        city: s.city,
        stateCode: s.stateCode,
        label: s.label,
        latitude: s.latitude,
        longitude: s.longitude,
        openCount: s.openCount,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "sites failed");
    res.json({ syncedAt: null, sites: [] });
  }
});

router.get("/sessions", async (req, res): Promise<void> => {
  const parsed = GetSessionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid 'site' parameter" });
    return;
  }
  try {
    const rows = await getServableRows();
    const syncedAt = await getLastSyncedAt();
    const matching = rows.filter((r) => siteKey(r.city, r.stateCode) === parsed.data.site);
    if (matching.length === 0) {
      res.status(404).json({ error: "No sessions found for this location" });
      return;
    }
    const first = matching[0]!;
    const city = sanitizeLabel(first.city);
    const stateCode = sanitizeLabel(first.stateCode);
    res.set("Cache-Control", CACHE_HEADER);
    res.json({
      syncedAt,
      site: { city, stateCode, label: `${city}, ${stateCode}` },
      sessions: matching.map(toSessionItem),
    });
  } catch (err) {
    req.log.error({ err }, "sessions failed");
    res.status(404).json({ error: "No sessions available right now" });
  }
});

router.get("/sessions/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  if (!raw || !/^\d+$/.test(raw)) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  try {
    const rows = await getServableRows();
    const syncedAt = await getLastSyncedAt();
    const row = rows.find((r) => String(r.shiftGroupId) === raw);
    if (!row) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
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
    req.log.error({ err }, "session detail failed");
    res.status(404).json({ error: "Session not found" });
  }
});

// --- ZIP geocoding (server-side so no third-party calls happen from the browser) ---
// Uses the free Zippopotam.us API (no key required). Results are cached
// in-memory since ZIP centroids never change.
const zipCache = new Map<string, { latitude: number; longitude: number } | null>();

router.get("/geocode-zip", async (req, res): Promise<void> => {
  const raw = typeof req.query["zip"] === "string" ? req.query["zip"].trim() : "";
  if (!/^\d{5}$/.test(raw)) {
    res.status(400).json({ error: "Enter a valid 5-digit ZIP code." });
    return;
  }
  try {
    let coords = zipCache.get(raw);
    if (coords === undefined) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const resp = await fetch(`https://api.zippopotam.us/us/${raw}`, {
          signal: controller.signal,
        });
        if (resp.ok) {
          const body = (await resp.json()) as {
            places?: { latitude: string; longitude: string }[];
          };
          const place = body.places?.[0];
          coords = place
            ? { latitude: Number(place.latitude), longitude: Number(place.longitude) }
            : null;
        } else if (resp.status === 404) {
          coords = null; // Unknown ZIP — cacheable negative result.
        } else {
          throw new Error(`geocoder responded ${resp.status}`);
        }
      } finally {
        clearTimeout(timer);
      }
      zipCache.set(raw, coords);
    }
    if (!coords || !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) {
      res.status(404).json({ error: "Enter a valid 5-digit ZIP code." });
      return;
    }
    res.set("Cache-Control", "public, max-age=86400");
    res.json({ zip: raw, latitude: coords.latitude, longitude: coords.longitude });
  } catch (err) {
    req.log.error({ err }, "geocode-zip failed");
    res.status(502).json({ error: "Could not look up that ZIP code right now." });
  }
});

// --- Eligibility (optional feature; simple in-memory rate limit, no PII in logs) ---
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

router.post("/eligibility", async (req, res): Promise<void> => {
  if (!eligibilityEnabled()) {
    res.status(404).json({ error: "This feature is not available" });
    return;
  }
  const ip = req.ip ?? "unknown";
  if (rateLimited(ip)) {
    res.status(429).json({ error: "Too many requests — try again in a minute" });
    return;
  }
  const parsed = CheckEligibilityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please enter your name and phone number" });
    return;
  }
  try {
    const phoneNorm = normalizePhone(parsed.data.phone);
    if (phoneNorm.length !== 10) {
      res.status(400).json({ error: "Please enter a valid 10-digit phone number" });
      return;
    }
    const [booking] = await db
      .select()
      .from(participantBookingsTable)
      .where(eq(participantBookingsTable.phoneNorm, phoneNorm));
    if (!booking) {
      res.json({
        found: false,
        completedCount: null,
        bookedCount: null,
        cap: 3,
        remaining: 3,
        isBlocked: false,
        message: "Looks like you haven't booked one yet — you can book up to 3.",
      });
      return;
    }
    const remaining = booking.isBlocked ? 0 : Math.max(0, booking.remaining);
    // isBlocked is returned for internal use only — the participant-facing
    // message never differs based on it.
    res.json({
      found: true,
      completedCount: booking.completedCount,
      bookedCount: booking.bookedCount,
      cap: 3,
      remaining,
      isBlocked: booking.isBlocked,
      message:
        remaining === 0
          ? "Unfortunately, you can't book more sessions — you've already hit the cap. Refer a friend who might be interested."
          : `You can book ${remaining} more session${remaining === 1 ? "" : "s"}.`,
    });
  } catch (err) {
    req.log.error({ err }, "eligibility lookup failed");
    res.status(400).json({ error: "We couldn't check right now — please try again" });
  }
});

export default router;
