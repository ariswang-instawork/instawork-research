import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const participantBookingsTable = pgTable("participant_booking", {
  id: serial("id").primaryKey(),
  phoneNorm: text("phone_norm").notNull().unique(),
  fullName: text("full_name"),
  completedCount: integer("completed_count").notNull().default(0),
  bookedCount: integer("booked_count").notNull().default(0),
  cap: integer("cap").notNull().default(3),
  remaining: integer("remaining").notNull().default(3),
  isBlocked: boolean("is_blocked").notNull().default(false),
  blockedCompanyNames: text("blocked_company_names"),
  blockedBusinessNames: text("blocked_business_names"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertParticipantBookingSchema = createInsertSchema(
  participantBookingsTable,
).omit({ id: true, syncedAt: true });
export type InsertParticipantBooking = z.infer<typeof insertParticipantBookingSchema>;
export type ParticipantBooking = typeof participantBookingsTable.$inferSelect;
