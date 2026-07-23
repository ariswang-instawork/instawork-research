import {
  pgTable,
  serial,
  bigint,
  text,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const shiftGroupsTable = pgTable(
  "shift_group",
  {
    id: serial("id").primaryKey(),
    shiftGroupId: bigint("shift_group_id", { mode: "number" }).notNull().unique(),
    siteLabel: text("site_label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    shiftLink: text("shift_link"),
    city: text("city"),
    stateCode: text("state_code"),
    fullAddress: text("full_address"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    timezone: text("timezone"),
    timezoneAbbr: text("timezone_abbr"),
    shiftDate: text("shift_date"),
    shiftStartAt: timestamp("shift_start_at", { withTimezone: true }),
    shiftEndAt: timestamp("shift_end_at", { withTimezone: true }),
    shiftStartTime: text("shift_start_time"),
    shiftEndTime: text("shift_end_time"),
    totalShiftsCount: integer("total_shifts_count").notNull().default(0),
    filledShiftsCount: integer("filled_shifts_count").notNull().default(0),
    openShiftsCount: integer("open_shifts_count").notNull().default(0),
    fillRatePct: doublePrecision("fill_rate_pct"),
    estBillableHours: doublePrecision("est_billable_hours"),
    estProPayPerSlotUsd: doublePrecision("est_pro_pay_per_slot_usd"),
    estSubtotalPerSlotUsd: doublePrecision("est_subtotal_per_slot_usd"),
    payRateUsd: doublePrecision("pay_rate_usd"),
    isOverbook: boolean("is_overbook").notNull().default(false),
    originalShiftGroupId: bigint("original_shift_group_id", { mode: "number" }),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("shift_group_sort_start_idx").on(t.sortOrder, t.shiftStartAt),
    index("shift_group_city_state_idx").on(t.city, t.stateCode),
  ],
);

export const insertShiftGroupSchema = createInsertSchema(shiftGroupsTable).omit({
  id: true,
  syncedAt: true,
});
export type InsertShiftGroup = z.infer<typeof insertShiftGroupSchema>;
export type ShiftGroup = typeof shiftGroupsTable.$inferSelect;
