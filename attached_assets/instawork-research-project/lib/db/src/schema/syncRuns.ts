import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const syncRunsTable = pgTable("sync_run", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull(), // "ok" | "error" | "skipped"
  rowCount: integer("row_count"),
  siteCount: integer("site_count"),
  message: text("message"),
});

export const insertSyncRunSchema = createInsertSchema(syncRunsTable).omit({ id: true });
export type InsertSyncRun = z.infer<typeof insertSyncRunSchema>;
export type SyncRun = typeof syncRunsTable.$inferSelect;
