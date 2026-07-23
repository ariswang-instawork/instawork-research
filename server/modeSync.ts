import { prisma } from "./db";
import { log } from "./index";

const MODE_BASE = "https://app.mode.com";
const MODE_WORKSPACE = process.env.MODE_WORKSPACE || "instawork";
const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

function authHeader(): string {
  const token = process.env.MODE_API_TOKEN;
  const secret = process.env.MODE_API_SECRET;
  if (!token || !secret) throw new Error("MODE_API_TOKEN / MODE_API_SECRET not configured");
  return "Basic " + Buffer.from(`${token}:${secret}`).toString("base64");
}

async function modeGet(path: string): Promise<any> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(MODE_BASE + path, {
        headers: { Authorization: authHeader(), Accept: "application/hal+json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(`Mode API ${path} responded ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

/**
 * Juicebox pattern: latest succeeded report run -> matching query run -> results content.
 */
async function fetchModeQueryRows(reportToken: string, queryToken: string): Promise<any[]> {
  const runs = await modeGet(`/api/${MODE_WORKSPACE}/reports/${reportToken}/runs?per_page=10`);
  const runList: any[] = runs._embedded?.report_runs ?? [];
  const succeeded = runList.find((r) => r.state === "succeeded");
  if (!succeeded) throw new Error(`No succeeded run found for report ${reportToken}`);

  const qrs = await modeGet(`/api/${MODE_WORKSPACE}/reports/${reportToken}/runs/${succeeded.token}/query_runs`);
  const qrList: any[] = qrs._embedded?.query_runs ?? [];
  const queryRun = qrList.find((q) => q.query_token === queryToken && q.state === "succeeded");
  if (!queryRun) throw new Error(`No succeeded query run for query ${queryToken} in report ${reportToken}`);

  const content = await modeGet(
    `/api/${MODE_WORKSPACE}/reports/${reportToken}/runs/${succeeded.token}/query_runs/${queryRun.token}/results/content.json`,
  );
  const rows = Array.isArray(content) ? content : content?.rows;
  if (!Array.isArray(rows)) throw new Error("Unexpected Mode results shape");
  return rows;
}

export function normalizePhone(phone: string | null | undefined): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.slice(-10);
}

const toInt = (v: any): number | null => (v === null || v === undefined || v === "" ? null : Math.trunc(Number(v)));
const toFloat = (v: any): number | null => (v === null || v === undefined || v === "" ? null : Number(v));
const toStr = (v: any): string | null => (v === null || v === undefined ? null : String(v));
const toBool = (v: any): boolean => v === true || v === "true" || v === 1;

function mapShiftGroup(r: any) {
  return {
    id: Number(r.shift_group_id),
    sortOrder: toInt(r.sort_order),
    siteLabel: toStr(r.site_label),
    shiftLink: toStr(r.shift_link),
    gigTemplateId: toInt(r.gig_template_id),
    internalName: toStr(r.internal_name),
    positionFkId: toInt(r.position_fk_id),
    positionName: toStr(r.position_name),
    companyId: toInt(r.company_id),
    companyName: toStr(r.company_name),
    businessId: toInt(r.business_id),
    businessName: toStr(r.business_name),
    placeId: toInt(r.place_id),
    city: toStr(r.city),
    stateCode: toStr(r.state_code),
    fullAddress: toStr(r.full_address),
    latitude: toFloat(r.latitude),
    longitude: toFloat(r.longitude),
    timezone: toStr(r.timezone),
    timezoneAbbr: toStr(r.timezone_abbr),
    shiftDate: toStr(r.shift_date),
    shiftStartTime: toStr(r.shift_start_time),
    shiftEndTime: toStr(r.shift_end_time),
    isOverbookShiftGroup: toBool(r.is_overbook_shift_group),
    originalShiftGroupId: toInt(r.original_shift_group_id),
    totalShiftsCount: toInt(r.total_shifts_count),
    filledShiftsCount: toInt(r.filled_shifts_count),
    openShiftsCount: toInt(r.open_shifts_count),
    fillRatePct: toFloat(r.fill_rate_pct),
    payRateUsd: toFloat(r.pay_rate_usd),
    billRateUsd: toFloat(r.bill_rate_usd),
    breakLength: toFloat(r.break_length),
    isBreakPaid: r.is_break_paid === null || r.is_break_paid === undefined ? null : toBool(r.is_break_paid),
    estBillableHoursPerSlot: toFloat(r.estimated_billable_hours_per_slot),
    estSubtotalPerSlotUsd: toFloat(r.estimated_subtotal_per_slot_usd),
    estFilledSubtotalUsd: toFloat(r.estimated_filled_subtotal_usd),
    estTotalSubtotalUsd: toFloat(r.estimated_total_subtotal_usd),
    estProPayPerSlotUsd: toFloat(r.estimated_pro_pay_per_slot_usd),
    estFilledProPayUsd: toFloat(r.estimated_filled_pro_pay_usd),
    estTotalProPayUsd: toFloat(r.estimated_total_pro_pay_usd),
  };
}

function mapBooking(r: any) {
  return {
    workerId: toInt(r.worker_id),
    businessId: Number(r.business_id),
    siteLabel: toStr(r.site_label),
    businessName: toStr(r.business_name),
    companyId: toInt(r.company_id),
    companyName: toStr(r.company_name),
    fullName: toStr(r.full_name),
    phone: toStr(r.phone),
    phoneNorm: normalizePhone(r.phone),
    completedCount: toInt(r.completed_count) ?? 0,
    bookedCount: toInt(r.booked_count) ?? 0,
    cap: toInt(r.cap),
    remaining: toInt(r.remaining),
    isBlocked: toBool(r.is_blocked),
    blockedCompanyId: toInt(r.blocked_company_id),
    blockedCompanyName: toStr(r.blocked_company_name),
    blockedBusinessName: toStr(r.blocked_business_name),
    lastBlockedAt: r.last_blocked_at ? new Date(r.last_blocked_at) : null,
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function recordSyncRun(source: string, fn: () => Promise<number>): Promise<{ source: string; ok: boolean; rowCount?: number; error?: string }> {
  const run = await prisma.syncRun.create({ data: { source, status: "running" } });
  try {
    const rowCount = await fn();
    await prisma.syncRun.update({
      where: { id: run.id },
      data: { status: "succeeded", rowCount, finishedAt: new Date() },
    });
    log(`sync ${source}: succeeded (${rowCount} rows)`, "mode-sync");
    return { source, ok: true, rowCount };
  } catch (err: any) {
    const message = String(err?.message ?? err).slice(0, 2000);
    await prisma.syncRun.update({
      where: { id: run.id },
      data: { status: "failed", error: message, finishedAt: new Date() },
    });
    log(`sync ${source}: FAILED — ${message}`, "mode-sync");
    return { source, ok: false, error: message };
  }
}

export async function syncShiftGroups() {
  return recordSyncRun("shift_group", async () => {
    const reportToken = process.env.MODE_REPORT_TOKEN;
    const queryToken = process.env.MODE_QUERY_TOKEN;
    if (!reportToken || !queryToken) throw new Error("MODE_REPORT_TOKEN / MODE_QUERY_TOKEN not configured");

    const rows = await fetchModeQueryRows(reportToken, queryToken);

    // Validate + dedupe by shift_group_id (last row wins); skip rows without a valid id.
    const byId = new Map<number, ReturnType<typeof mapShiftGroup>>();
    let skipped = 0;
    for (const r of rows) {
      const id = Number(r?.shift_group_id);
      if (!Number.isInteger(id) || id <= 0) {
        skipped++;
        continue;
      }
      byId.set(id, mapShiftGroup(r));
    }
    const data = Array.from(byId.values());
    if (skipped > 0) log(`shift_group: skipped ${skipped} rows with invalid shift_group_id`, "mode-sync");

    // Guardrail: never wipe existing data unless we have valid replacement rows.
    if (data.length === 0) throw new Error("Mode returned 0 valid shift_group rows — keeping existing data");

    await prisma.$transaction(
      async (tx) => {
        await tx.shiftGroup.deleteMany();
        for (const batch of chunk(data, 1000)) {
          await tx.shiftGroup.createMany({ data: batch });
        }
      },
      { timeout: 120_000 },
    );
    return data.length;
  });
}

export async function syncBookings() {
  return recordSyncRun("participant_booking", async () => {
    const reportToken = process.env.MODE_BOOKINGS_REPORT_TOKEN;
    const queryToken = process.env.MODE_BOOKINGS_QUERY_TOKEN;
    if (!reportToken || !queryToken) throw new Error("MODE_BOOKINGS_REPORT_TOKEN / MODE_BOOKINGS_QUERY_TOKEN not configured");

    const rows = await fetchModeQueryRows(reportToken, queryToken);

    // Validate rows: require a valid 10-digit normalized phone and a valid business_id,
    // otherwise distinct workers would collapse under the (phoneNorm, businessId) unique key.
    // Dedupe by (phoneNorm, businessId) to satisfy the unique constraint (last row wins).
    const byKey = new Map<string, ReturnType<typeof mapBooking>>();
    let skipped = 0;
    for (const r of rows) {
      const mapped = mapBooking(r);
      if (mapped.phoneNorm.length !== 10 || !Number.isInteger(mapped.businessId) || mapped.businessId <= 0) {
        skipped++;
        continue;
      }
      byKey.set(`${mapped.phoneNorm}|${mapped.businessId}`, mapped);
    }
    const data = Array.from(byKey.values());
    if (skipped > 0) log(`participant_booking: skipped ${skipped} rows with invalid phone/business_id`, "mode-sync");

    // Guardrail: never wipe existing data unless we have valid replacement rows.
    if (data.length === 0) throw new Error("Mode returned 0 valid participant_booking rows — keeping existing data");

    await prisma.$transaction(
      async (tx) => {
        await tx.participantBooking.deleteMany();
        for (const batch of chunk(data, 5000)) {
          await tx.participantBooking.createMany({ data: batch });
        }
      },
      { timeout: 300_000, maxWait: 30_000 },
    );
    return data.length;
  });
}

export async function syncAll() {
  const results = [await syncShiftGroups(), await syncBookings()];
  return results;
}

export async function logDataSummary() {
  const [shiftGroupCount, bookingCount] = await Promise.all([
    prisma.shiftGroup.count(),
    prisma.participantBooking.count(),
  ]);
  log(`shift_group rows: ${shiftGroupCount}`, "data");
  log(`participant_booking rows: ${bookingCount}`, "data");
  const sampleShift = await prisma.shiftGroup.findFirst();
  const rawBooking = await prisma.participantBooking.findFirst();
  // Redact PII (name/phone) from the booking sample — it is logged and exposed via /admin.
  const sampleBooking = rawBooking
    ? {
        ...rawBooking,
        fullName: rawBooking.fullName ? rawBooking.fullName[0] + "***" : null,
        phone: rawBooking.phone ? "***" + normalizePhone(rawBooking.phone).slice(-4) : null,
        phoneNorm: "***" + rawBooking.phoneNorm.slice(-4),
      }
    : null;
  if (sampleShift) log(`sample shift_group: ${JSON.stringify(sampleShift).slice(0, 400)}`, "data");
  if (sampleBooking) log(`sample participant_booking: ${JSON.stringify(sampleBooking).slice(0, 400)}`, "data");
  return { shiftGroupCount, bookingCount, sampleShift, sampleBooking };
}
