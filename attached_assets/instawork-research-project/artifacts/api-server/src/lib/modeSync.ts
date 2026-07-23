import {
  db,
  shiftGroupsTable,
  syncRunsTable,
  participantBookingsTable,
  type InsertShiftGroup,
  type InsertParticipantBooking,
} from "@workspace/db";
import { logger } from "./logger";

const MODE_BASE = "https://app.mode.com/api";

interface ModeEnv {
  token: string;
  secret: string;
  workspace: string;
  reportToken: string;
  queryToken: string;
}

function getModeEnv(): ModeEnv | null {
  const token = process.env["MODE_API_TOKEN"];
  const secret = process.env["MODE_API_SECRET"];
  const workspace = process.env["MODE_WORKSPACE"];
  const reportToken = process.env["MODE_REPORT_TOKEN"];
  const queryToken = process.env["MODE_QUERY_TOKEN"];
  if (!token || !secret || !workspace || !reportToken || !queryToken) return null;
  return { token, secret, workspace, reportToken, queryToken };
}

function authHeader(env: ModeEnv): string {
  return "Basic " + Buffer.from(`${env.token}:${env.secret}`).toString("base64");
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 2,
  timeoutMs = 10_000,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...init, signal: ctrl.signal });
        if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
        return res;
      } finally {
        clearTimeout(t);
      }
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Fetch the latest successful run's result content for a Mode query.
 * Returns parsed rows (array of objects).
 */
/**
 * Resolve a Mode API link href to an absolute URL, allowing only app.mode.com
 * so credentials are never sent to a foreign host (SSRF guard).
 */
function absoluteModeUrl(href: string): string {
  const url = new URL(href, "https://app.mode.com");
  if (url.protocol !== "https:" || url.hostname !== "app.mode.com") {
    throw new Error("Refusing to follow Mode link to non-Mode host");
  }
  return url.toString();
}

async function fetchModeQueryRows(
  env: ModeEnv,
  reportToken: string,
  queryToken: string,
): Promise<Record<string, unknown>[]> {
  const headers = { Authorization: authHeader(env), Accept: "application/json" };
  const runsUrl = `${MODE_BASE}/${env.workspace}/reports/${reportToken}/queries/${queryToken}/runs`;
  const runsRes = await fetchWithRetry(runsUrl, { headers });
  if (!runsRes.ok) throw new Error(`Mode runs list failed: HTTP ${runsRes.status}`);
  const runsJson = (await runsRes.json()) as {
    _embedded?: { query_runs?: Array<Record<string, unknown>> };
  };
  const runs = [...(runsJson._embedded?.query_runs ?? [])].sort((a, b) => {
    const ta = Date.parse(String(a["created_at"] ?? "")) || 0;
    const tb = Date.parse(String(b["created_at"] ?? "")) || 0;
    return tb - ta;
  });
  const succeeded = runs.find((r) => r["state"] === "succeeded");
  if (!succeeded) throw new Error("No successful Mode query run found");

  // Follow run -> result content link
  const links = succeeded["_links"] as Record<string, { href?: string }> | undefined;
  const resultHref = links?.["result"]?.href;
  if (!resultHref) throw new Error("Mode run has no result link");
  const resultRes = await fetchWithRetry(absoluteModeUrl(resultHref), { headers });
  if (!resultRes.ok) throw new Error(`Mode result failed: HTTP ${resultRes.status}`);
  const resultJson = (await resultRes.json()) as {
    _links?: Record<string, { href?: string }>;
  };
  const contentHref =
    resultJson._links?.["content"]?.href ?? resultJson._links?.["csv"]?.href;
  if (!contentHref) throw new Error("Mode result has no content link");
  const contentRes = await fetchWithRetry(absoluteModeUrl(contentHref), {
    headers: { Authorization: authHeader(env) },
  });
  if (!contentRes.ok) throw new Error(`Mode content failed: HTTP ${contentRes.status}`);
  const contentType = contentRes.headers.get("content-type") ?? "";
  const text = await contentRes.text();
  if (contentType.includes("json")) {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
    // Some Mode content endpoints return { columns, rows }
    const obj = parsed as { columns?: string[]; rows?: unknown[][] };
    if (obj.columns && obj.rows) {
      return obj.rows.map((row) =>
        Object.fromEntries(obj.columns!.map((c, i) => [c, row[i]])),
      );
    }
    throw new Error("Unrecognized Mode JSON content shape");
  }
  return parseCsv(text);
}

/** Minimal CSV parser handling quoted fields. */
export function parseCsv(text: string): Record<string, unknown>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  if (rows.length < 2) return [];
  const header = rows[0]!;
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function bool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").toLowerCase();
  return s === "true" || s === "t" || s === "1";
}

function parseShiftGroupRow(raw: Record<string, unknown>): InsertShiftGroup | null {
  const shiftGroupId = num(raw["shift_group_id"]);
  const shiftDate = str(raw["shift_date"]);
  if (shiftGroupId == null || !shiftDate) return null;
  const startAtRaw = str(raw["shift_start_at"]) ?? `${shiftDate}T00:00:00Z`;
  const startAt = new Date(startAtRaw);
  const endAtRaw = str(raw["shift_end_at"]);
  return {
    shiftGroupId,
    siteLabel: str(raw["site_label"]) ?? "unknown",
    sortOrder: num(raw["sort_order"]) ?? 0,
    shiftLink: str(raw["shift_link"]),
    city: str(raw["city"]),
    stateCode: str(raw["state_code"]),
    fullAddress: str(raw["full_address"]),
    latitude: num(raw["latitude"]),
    longitude: num(raw["longitude"]),
    timezone: str(raw["timezone"]),
    timezoneAbbr: str(raw["timezone_abbr"]),
    shiftDate,
    shiftStartAt: Number.isNaN(startAt.getTime()) ? null : startAt,
    shiftEndAt: endAtRaw ? new Date(endAtRaw) : null,
    shiftStartTime: str(raw["shift_start_time"]),
    shiftEndTime: str(raw["shift_end_time"]),
    totalShiftsCount: num(raw["total_shifts_count"]) ?? 0,
    filledShiftsCount: num(raw["filled_shifts_count"]) ?? 0,
    openShiftsCount: num(raw["open_shifts_count"]) ?? 0,
    fillRatePct: num(raw["fill_rate_pct"]),
    estBillableHours: num(raw["estimated_billable_hours_per_slot"]),
    estProPayPerSlotUsd: num(raw["estimated_pro_pay_per_slot_usd"]),
    estSubtotalPerSlotUsd: num(raw["estimated_subtotal_per_slot_usd"]),
    payRateUsd: num(raw["pay_rate_usd"]),
    isOverbook: bool(raw["is_overbook_shift_group"]),
    originalShiftGroupId: num(raw["original_shift_group_id"]),
  };
}

let isSyncing = false;

export interface SyncOutcome {
  status: "ok" | "error" | "skipped" | "already_running";
  message?: string;
  rowCount?: number;
  siteCount?: number;
}

export function eligibilityEnabled(): boolean {
  return Boolean(
    process.env["MODE_BOOKINGS_REPORT_TOKEN"] && process.env["MODE_BOOKINGS_QUERY_TOKEN"],
  );
}

export async function syncShiftGroups(): Promise<SyncOutcome> {
  if (isSyncing) return { status: "already_running", message: "Sync already running" };
  isSyncing = true;
  const startedAt = new Date();
  const t0 = Date.now();
  try {
    const env = getModeEnv();
    if (!env) {
      const message =
        "Missing Mode secrets (MODE_API_TOKEN, MODE_API_SECRET, MODE_WORKSPACE, MODE_REPORT_TOKEN, MODE_QUERY_TOKEN) — sync skipped";
      await db.insert(syncRunsTable).values({
        startedAt,
        finishedAt: new Date(),
        status: "skipped",
        message,
      });
      logger.warn({ status: "skipped" }, "Mode sync skipped: missing secrets");
      return { status: "skipped", message };
    }

    let rawRows: Record<string, unknown>[];
    try {
      rawRows = await fetchModeQueryRows(env, env.reportToken, env.queryToken);
    } catch (err) {
      const message = `Mode fetch failed: ${err instanceof Error ? err.message : String(err)}`;
      await db.insert(syncRunsTable).values({
        startedAt,
        finishedAt: new Date(),
        status: "error",
        message,
      });
      logger.error({ err, ms: Date.now() - t0 }, "Mode sync error (kept existing data)");
      return { status: "error", message };
    }

    const parsed = rawRows
      .map(parseShiftGroupRow)
      .filter((r): r is InsertShiftGroup => r !== null);

    if (parsed.length === 0) {
      const message = "0 rows parsed — kept existing data";
      await db.insert(syncRunsTable).values({
        startedAt,
        finishedAt: new Date(),
        status: "error",
        rowCount: 0,
        message,
      });
      logger.error({ ms: Date.now() - t0 }, "Mode sync returned 0 rows; kept existing data");
      return { status: "error", message, rowCount: 0 };
    }

    const siteCount = new Set(parsed.map((r) => r.siteLabel)).size;

    await db.transaction(async (tx) => {
      await tx.delete(shiftGroupsTable);
      await tx.insert(shiftGroupsTable).values(parsed);
    });

    await db.insert(syncRunsTable).values({
      startedAt,
      finishedAt: new Date(),
      status: "ok",
      rowCount: parsed.length,
      siteCount,
    });

    // Optional participant bookings sync
    if (eligibilityEnabled()) {
      try {
        await syncParticipantBookings(env);
      } catch (err) {
        // Log message only — a DB error here can embed query params (PII).
        logger.error(
          { message: err instanceof Error ? err.message : String(err) },
          "Participant bookings sync failed (non-fatal)",
        );
      }
    }

    logger.info(
      { rows: parsed.length, sites: siteCount, ms: Date.now() - t0, status: "ok" },
      "Mode sync complete",
    );
    return { status: "ok", rowCount: parsed.length, siteCount };
  } finally {
    isSyncing = false;
  }
}

async function syncParticipantBookings(env: ModeEnv): Promise<void> {
  const bookingsReportToken = process.env["MODE_BOOKINGS_REPORT_TOKEN"];
  const bookingsQueryToken = process.env["MODE_BOOKINGS_QUERY_TOKEN"];
  if (!bookingsReportToken || !bookingsQueryToken) return;
  const rawRows = await fetchModeQueryRows(env, bookingsReportToken, bookingsQueryToken);
  const parsed: InsertParticipantBooking[] = [];
  for (const raw of rawRows) {
    const phone = str(raw["phone"]);
    if (!phone) continue;
    const phoneNorm = normalizePhone(phone);
    if (phoneNorm.length !== 10) continue;
    const completedCount = num(raw["completed_count"]) ?? 0;
    const bookedCount = num(raw["booked_count"]) ?? 0;
    const cap = num(raw["cap"]) ?? 3;
    parsed.push({
      phoneNorm,
      fullName: str(raw["full_name"]),
      completedCount,
      bookedCount,
      cap,
      // Mode provides remaining (0 if blocked/at cap); fall back to the
      // formula cap - completed - booked when the column is absent.
      remaining:
        num(raw["remaining"]) ??
        Math.max(0, cap - completedCount - bookedCount),
      isBlocked: bool(raw["is_blocked"]),
      blockedCompanyNames: str(raw["blocked_company_names"]),
      blockedBusinessNames: str(raw["blocked_business_names"]),
    });
  }
  if (parsed.length === 0) {
    logger.warn("Participant bookings query returned 0 rows; kept existing data");
    return;
  }
  // de-dupe by phoneNorm (last wins)
  const byPhone = new Map(parsed.map((p) => [p.phoneNorm, p]));
  // Chunk the insert to stay under Postgres's 65,535-bind-parameter limit.
  const rows = [...byPhone.values()];
  const CHUNK = 2000;
  await db.transaction(async (tx) => {
    await tx.delete(participantBookingsTable);
    for (let i = 0; i < rows.length; i += CHUNK) {
      await tx.insert(participantBookingsTable).values(rows.slice(i, i + CHUNK));
    }
  });
  logger.info({ rows: byPhone.size }, "Participant bookings sync complete");
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-10);
}

let intervalStarted = false;

/** Run once on boot and every ~10 minutes in-process. */
export function scheduleSync(): void {
  if (intervalStarted) return;
  intervalStarted = true;
  void syncShiftGroups().catch((err) =>
    logger.error({ err }, "Boot sync failed unexpectedly"),
  );
  setInterval(
    () => {
      void syncShiftGroups().catch((err) =>
        logger.error({ err }, "Scheduled sync failed unexpectedly"),
      );
    },
    10 * 60 * 1000,
  );
}
