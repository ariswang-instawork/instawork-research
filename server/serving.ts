import type { ShiftGroup } from "@prisma/client";
import { prisma } from "./db";

// --- Sanitization: strip internal codenames / partner names from UI-bound strings ---
const BANNED_PATTERNS: RegExp[] = [
  /q\s*\.?\s*ai/gi, // Q.ai, QAI, Q AI
  /ux[\s-]?study/gi,
];

export function sanitizeLabel(s: string | null | undefined): string {
  if (!s) return "";
  let out = s;
  for (const re of BANNED_PATTERNS) out = out.replace(re, "");
  out = out.replace(/\s{2,}/g, " ");
  out = out.replace(/^[\s\-·,:]+|[\s\-·,:]+$/g, "");
  return out;
}

export function siteKey(city: string | null, stateCode: string | null): string {
  return `${(city ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${(stateCode ?? "").toLowerCase()}`.replace(
    /^-+|-+$/g,
    "",
  );
}

function isValidHttpsUrl(u: string | null): u is string {
  if (!u) return false;
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Upcoming, bookable, non-overbook rows with a valid https book link. */
export async function getServableRows(): Promise<ShiftGroup[]> {
  const rows = await prisma.shiftGroup.findMany({
    where: {
      isOverbookShiftGroup: false,
      openShiftsCount: { gt: 0 },
      shiftDate: { gte: todayISO() },
    },
    orderBy: [{ shiftDate: "asc" }, { shiftStartTime: "asc" }],
  });
  return rows.filter((r) => isValidHttpsUrl(r.shiftLink));
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
    const startMeridiem = start.match(/(AM|PM)$/i)?.[0];
    const endMeridiem = end.match(/(AM|PM)$/i)?.[0];
    if (startMeridiem && endMeridiem && startMeridiem.toUpperCase() === endMeridiem.toUpperCase()) {
      return `${start.replace(/\s*(AM|PM)$/i, "")} – ${end}`;
    }
    return `${start} – ${end}`;
  }
  return start || end || "";
}

/**
 * Derive a short neighborhood/area label from the site label when it adds
 * information beyond the city name. Never exposes company/business names.
 */
function deriveNeighborhoodLabel(row: ShiftGroup): string | null {
  const label = sanitizeLabel(row.siteLabel ?? "").trim();
  const city = (row.city ?? "").trim().toLowerCase();
  if (!label) return null;
  if (city && label.toLowerCase() === city) return null;
  if (/[\d()]/.test(label)) return null;
  return label;
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

export function toSessionItem(row: ShiftGroup): SessionItemJson {
  // Shift pay comes straight from Mode's estimated_pro_pay_per_slot_usd —
  // displayed exactly as returned (no rounding, no approximation marker).
  const pay = row.estProPayPerSlotUsd;
  const hours = row.estBillableHoursPerSlot != null ? Math.round(row.estBillableHoursPerSlot) : null;
  const payLabel = pay != null ? `$${pay}` : "$72";
  return {
    id: String(row.id),
    date: sanitizeLabel(formatDateLabel(row.shiftDate ?? "")),
    dateISO: row.shiftDate ?? "",
    time: sanitizeLabel(formatTimeRange(row)),
    payLabel,
    payAmount: payLabel.replace("$", ""),
    payRateUsd: row.payRateUsd,
    billableHours: row.estBillableHoursPerSlot,
    hoursLabel: hours != null ? `~${hours} hrs` : "~3 hrs",
    booked: row.filledShiftsCount ?? 0,
    total: row.totalShiftsCount ?? 0,
    open: row.openShiftsCount ?? 0,
    bookUrl: row.shiftLink ?? "",
    fullAddress: row.fullAddress ? sanitizeLabel(row.fullAddress) : null,
    latitude: row.latitude,
    longitude: row.longitude,
    neighborhoodLabel: deriveNeighborhoodLabel(row),
  };
}

export async function getLastSyncedAt(): Promise<string | null> {
  const row = await prisma.shiftGroup.findFirst({ orderBy: { syncedAt: "desc" } });
  return row ? row.syncedAt.toISOString() : null;
}

export async function getLastSyncRun() {
  return prisma.syncRun.findFirst({ orderBy: { startedAt: "desc" } });
}

export function syncRunToJson(run: {
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  rowCount: number | null;
  error: string | null;
}) {
  return {
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
    rowCount: run.rowCount,
    siteCount: null,
    message: run.error,
  };
}

export function eligibilityEnabled(): boolean {
  return Boolean(process.env.MODE_BOOKINGS_REPORT_TOKEN && process.env.MODE_BOOKINGS_QUERY_TOKEN);
}
