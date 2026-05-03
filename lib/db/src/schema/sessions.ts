import { pgTable, serial, integer, timestamp, real, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { exercisesTable } from "./exercises";

export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  exerciseId: integer("exercise_id").notNull().references(() => exercisesTable.id),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  totalReps: integer("total_reps").notNull().default(0),
  avgFormScore: real("avg_form_score"),
  notes: text("notes"),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ id: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
