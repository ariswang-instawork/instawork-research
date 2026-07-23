import type { Express } from "express";
import { prisma } from "./db";
import { normalizePhone, syncAll, logDataSummary } from "./modeSync";

export function registerApiRoutes(app: Express) {
  app.get("/api/health", async (_req, res) => {
    try {
      const [shiftGroupCount, bookingCount, lastSync] = await Promise.all([
        prisma.shiftGroup.count(),
        prisma.participantBooking.count(),
        prisma.syncRun.findFirst({ orderBy: { startedAt: "desc" } }),
      ]);
      const lastSucceeded = await prisma.syncRun.findFirst({
        where: { status: "succeeded" },
        orderBy: { finishedAt: "desc" },
      });
      res.json({
        ok: true,
        syncedAt: lastSucceeded?.finishedAt ?? null,
        shiftGroupCount,
        bookingCount,
        lastSync: lastSync
          ? {
              source: lastSync.source,
              status: lastSync.status,
              rowCount: lastSync.rowCount,
              error: lastSync.error,
              startedAt: lastSync.startedAt,
              finishedAt: lastSync.finishedAt,
            }
          : null,
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err?.message ?? err) });
    }
  });

  app.get("/api/shift-groups", async (req, res) => {
    try {
      const city = typeof req.query.city === "string" && req.query.city.trim() ? req.query.city.trim() : undefined;
      const today = new Date().toISOString().slice(0, 10);
      const rows = await prisma.shiftGroup.findMany({
        where: {
          openShiftsCount: { gt: 0 },
          isOverbookShiftGroup: false,
          shiftDate: { gte: today },
          ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
        },
        orderBy: [{ shiftDate: "asc" }, { shiftStartTime: "asc" }, { sortOrder: "asc" }],
      });
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message ?? err) });
    }
  });

  app.get("/api/shift-groups/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    try {
      const row = await prisma.shiftGroup.findUnique({ where: { id } });
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message ?? err) });
    }
  });

  app.post("/api/eligibility", async (req, res) => {
    const phone = req.body?.phone;
    if (typeof phone !== "string" || !phone.trim()) {
      return res.status(400).json({ error: "phone is required" });
    }
    const phoneNorm = normalizePhone(phone);
    if (phoneNorm.length !== 10) {
      return res.status(400).json({ error: "phone must contain at least 10 digits" });
    }
    try {
      const bookings = await prisma.participantBooking.findMany({
        where: { phoneNorm },
        orderBy: { businessId: "asc" },
      });
      res.json({ phoneNorm, found: bookings.length > 0, bookings });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message ?? err) });
    }
  });

  app.post("/api/cron/sync-mode", async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(503).json({ error: "CRON_SECRET is not configured" });
    if (req.get("x-cron-secret") !== secret) return res.status(401).json({ error: "Unauthorized" });
    try {
      const results = await syncAll();
      res.status(results.every((r) => r.ok) ? 200 : 500).json({ results });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message ?? err) });
    }
  });

  app.get("/admin", async (_req, res) => {
    try {
      const summary = await logDataSummary();
      const recentSyncs = await prisma.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 });
      res.json({ ...summary, recentSyncs });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message ?? err) });
    }
  });
}
