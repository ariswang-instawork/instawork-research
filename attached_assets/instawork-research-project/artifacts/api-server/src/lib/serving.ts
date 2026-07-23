import { and, eq, gte, gt, desc, asc } from "drizzle-orm";
import { db, shiftGroupsTable, syncRunsTable, type ShiftGroup } from "@workspace/db";
import { sanitizeLabel } from "./sanitize";

export function siteKey(city: string | null, stateCode: string | null): string {
  return `${(city ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${(
    stateCode ?? ""
  ).toLowerCase()}`.replace(/^-+|-+$/g, "");
}

function isValidHttpsUrl(u: string | null): u is string {
  if (!u) return false;
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
}

/** Upcoming, bookable, non-overbook rows with a valid https book link. */
export async function getServableRows(): Promise<ShiftGroup[]> {
  const rows = await db
    .select()
    .from(shiftGroupsTable)
    .where(
      and(
        eq(shiftGroupsTable.isOverbook, false),
        gt(shiftGroupsTable.openShiftsCount, 0),
        gte(shiftGroupsTable.shiftStartAt, new Date()),
      ),
    )
    .orderBy(asc(shiftGroupsTable.shiftStartAt));
  return rows.filter((r) => isValidHttpsUrl(r.shiftLink));
}

/**
 * Upcoming rows for map/site aggregation. Includes overbook rows and rows
 * with 0 openings (they add nothing to sums) — per product decision, the
 * map pin count is the sum of open_shifts_count across ALL upcoming shift
 * groups for a site, overbook included.
 */
export async function getSiteAggregateRows(): Promise<ShiftGroup[]> {
  return db
    .select()
    .from(shiftGroupsTable)
    .where(gte(shiftGroupsTable.shiftStartAt, new Date()));
}

export function formatDateLabel(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatTimeRange(row: ShiftGroup): string {
  const start = row.shiftStartTime ?? "";
  const end = row.shiftEndTime ?? "";
  if (start && end) {
    // "5:30 PM" + "8:30 PM" -> "5:30 – 8:30 PM" when same meridiem
    const startMeridiem = start.match(/(AM|PM)$/i)?.[0];
    const endMeridiem = end.match(/(AM|PM)$/i)?.[0];
    if (
      startMeridiem &&
      endMeridiem &&
      startMeridiem.toUpperCase() === endMeridiem.toUpperCase()
    ) {
      return `${start.replace(/\s*(AM|PM)$/i, "")} – ${end}`;
    }
    return `${start} – ${end}`;
  }
  return start || end || "";
}

export interface SessionItemJson {
  id: string;
  date: string;
  dateISO: string;
  time: string;
  payLabel: string;
  payAmount: string;
  payRateUsd: number | null;
  billableHours: number | null;
  hoursLabel: string;
  booked: number;
  total: number;
  open: number;
  bookUrl: string;
  fullAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  neighborhoodLabel: string | null;
}

/**
 * Derive a short neighborhood/area label from the site label when it adds
 * information beyond the city name (e.g. "Chicago — River North"). Never
 * exposes company/business names — siteLabel comes from Mode's site_label.
 */
function deriveNeighborhoodLabel(row: ShiftGroup): string | null {
  const label = sanitizeLabel(row.siteLabel ?? "").trim();
  const city = (row.city ?? "").trim().toLowerCase();
  if (!label) return null;
  if (city && label.toLowerCase() === city) return null;
  // Internal ops labels like "Philly 1 (2)" contain digits/parentheses —
  // only surface clean, human area names.
  if (/[\d()]/.test(label)) return null;
  return label;
}

export function toSessionItem(row: ShiftGroup): SessionItemJson {
  // Shift pay comes straight from Mode's estimated_pro_pay_per_slot_usd —
  // displayed exactly as returned (no rounding, no "~" approximation marker).
  const pay = row.estProPayPerSlotUsd;
  const hours = row.estBillableHours != null ? Math.round(row.estBillableHours) : null;
  const payLabel = pay != null ? `$${pay}` : "$72";
  return {
    id: String(row.shiftGroupId),
    date: sanitizeLabel(formatDateLabel(row.shiftDate ?? "")),
    dateISO: row.shiftDate ?? "",
    time: sanitizeLabel(formatTimeRange(row)),
    payLabel,
    payAmount: payLabel.replace("$", ""),
    payRateUsd: row.payRateUsd,
    billableHours: row.estBillableHours,
    hoursLabel: hours != null ? `~${hours} hrs` : "~3 hrs",
    booked: row.filledShiftsCount,
    total: row.totalShiftsCount,
    open: row.openShiftsCount,
    bookUrl: row.shiftLink ?? "",
    fullAddress: row.fullAddress ? sanitizeLabel(row.fullAddress) : null,
    latitude: row.latitude,
    longitude: row.longitude,
    neighborhoodLabel: deriveNeighborhoodLabel(row),
  };
}

export async function getLastSyncedAt(): Promise<string | null> {
  const [row] = await db
    .select()
    .from(shiftGroupsTable)
    .orderBy(desc(shiftGroupsTable.syncedAt))
    .limit(1);
  return row ? row.syncedAt.toISOString() : null;
}

export async function getLastSyncRun() {
  const [run] = await db
    .select()
    .from(syncRunsTable)
    .orderBy(desc(syncRunsTable.startedAt))
    .limit(1);
  return run ?? null;
}

export function syncRunToJson(run: {
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  rowCount: number | null;
  siteCount: number | null;
  message: string | null;
}) {
  return {
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
    rowCount: run.rowCount,
    siteCount: run.siteCount,
    message: run.message,
  };
}
