import { Router, type IRouter, type Request } from "express";
import { desc } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import { db, syncRunsTable } from "@workspace/db";
import { GetAdminStatusBody, TriggerAdminSyncBody } from "@workspace/api-zod";
import { getServableRows, getLastSyncedAt, siteKey, syncRunToJson } from "../lib/serving";
import { syncShiftGroups, eligibilityEnabled } from "../lib/modeSync";

const router: IRouter = Router();

function checkPassword(candidate: string): boolean {
  const expected = process.env["ADMIN_PASSWORD"];
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

router.post("/admin/status", async (req, res): Promise<void> => {
  const parsed = GetAdminStatusBody.safeParse(req.body);
  if (!parsed.success || !authorized(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const rows = await getServableRows();
  const syncedAt = await getLastSyncedAt();
  const runs = await db
    .select()
    .from(syncRunsTable)
    .orderBy(desc(syncRunsTable.startedAt))
    .limit(10);
  res.json({
    sessionCount: rows.length,
    siteCount: new Set(rows.map((r) => siteKey(r.city, r.stateCode))).size,
    syncedAt,
    eligibilityEnabled: eligibilityEnabled(),
    recentRuns: runs.map(syncRunToJson),
  });
});

router.post("/admin/sync", async (req, res): Promise<void> => {
  const parsed = TriggerAdminSyncBody.safeParse(req.body);
  if (!parsed.success || !authorized(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const outcome = await syncShiftGroups();
  res.json({
    status: outcome.status,
    message: outcome.message ?? null,
    rowCount: outcome.rowCount ?? null,
    siteCount: outcome.siteCount ?? null,
  });
});

// Cron endpoint — protected by x-cron-secret header, not in the OpenAPI contract.
router.post("/cron/sync-mode", async (req, res): Promise<void> => {
  const secret = process.env["CRON_SECRET"];
  const provided = req.get("x-cron-secret");
  if (!secret || !provided || provided !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const outcome = await syncShiftGroups();
  res.json({
    status: outcome.status,
    message: outcome.message ?? null,
    rowCount: outcome.rowCount ?? null,
    siteCount: outcome.siteCount ?? null,
  });
});

export default router;
