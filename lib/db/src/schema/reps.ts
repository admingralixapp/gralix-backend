import { pgTable, serial, integer, real, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sessionsTable } from "./sessions";

export const repsTable = pgTable("reps", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessionsTable.id),
  repNumber: integer("rep_number").notNull(),
  formScore: real("form_score").notNull(),
  durationMs: integer("duration_ms"),
  feedbackGiven: text("feedback_given"),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRepSchema = createInsertSchema(repsTable).omit({ id: true });
export type InsertRep = z.infer<typeof insertRepSchema>;
export type Rep = typeof repsTable.$inferSelect;
