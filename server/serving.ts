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

/** Servable rows for a single business (site), same ordering as getServableRows. */
export async function getServableRowsForBusiness(businessId: number): Promise<ShiftGroup[]> {
  const rows = await getServableRows();
  return rows.filter((r) => r.businessId === businessId);
}

/**
 * Upcoming rows for map/site aggregation. Includes overbook rows and rows
 * with 0 openings — per product decision, the map pin count is the sum of
 * open_shifts_count across ALL upcoming shift groups for a site.
 */
export async function getSiteAggregateRows(): Promise<ShiftGroup[]> {
  return prisma.shiftGroup.findMany({ where: { shiftDate: { gte: todayISO() } } });
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
    return `${start} – ${end}`;
  }
  return start || end || "";
}

/**
 * Location-facing site name for My sessions (e.g. "Boston, MA", "Philadelphia, PA (1)").
 * Uses city/state and location codenames — never business or company names.
 */
export function formatEligibilitySiteLabel(row: {
  siteLabel?: string | null;
  city?: string | null;
  stateCode?: string | null;
  businessName?: string | null;
  companyName?: string | null;
}): string {
  let siteLabel = sanitizeLabel(row.siteLabel ?? "").trim();
  const city = sanitizeLabel(row.city ?? "").trim();
  const stateCode = sanitizeLabel(row.stateCode ?? "").trim();
  const businessName = sanitizeLabel(row.businessName ?? "").trim();
  const companyName = sanitizeLabel(row.companyName ?? "").trim();

  if (siteLabel && (siteLabel === businessName || siteLabel === companyName)) {
    siteLabel = "";
  }

  if (siteLabel && city && siteLabel.toLowerCase() !== city.toLowerCase()) {
    const suffixMatch = siteLabel.match(
      new RegExp(`^${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(.+)$`, "i"),
    );
    if (suffixMatch) {
      const suffix = suffixMatch[1].trim();
      if (city && stateCode) return `${city}, ${stateCode} (${suffix})`;
      if (city) return `${city} (${suffix})`;
    }
    return stateCode ? `${siteLabel}, ${stateCode}` : siteLabel;
  }

  if (city && stateCode) return `${city}, ${stateCode}`;
  if (city) return city;
  if (siteLabel) return stateCode ? `${siteLabel}, ${stateCode}` : siteLabel;
  return "Session site";
}

/** One display label per business_id from synced shift rows. */
export async function getSiteLabelsByBusinessId(): Promise<Map<number, string>> {
  const rows = await prisma.shiftGroup.findMany({
    select: {
      businessId: true,
      siteLabel: true,
      city: true,
      stateCode: true,
      businessName: true,
      companyName: true,
    },
    orderBy: { shiftDate: "asc" },
  });
  const map = new Map<number, string>();
  for (const row of rows) {
    if (row.businessId == null || map.has(row.businessId)) continue;
    map.set(row.businessId, formatEligibilitySiteLabel(row));
  }
  return map;
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

/**
 * Redacts the exact street address and coordinates before a session is sent
 * to public, unauthenticated endpoints. The precise location is only
 * revealed after the visitor books through the Instawork app — sending it
 * here would defeat that regardless of what the page itself renders.
 */
export function toPublicSessionItem(row: ShiftGroup): SessionItemJson {
  return { ...toSessionItem(row), fullAddress: null, latitude: null, longitude: null };
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
