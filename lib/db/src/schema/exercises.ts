import { pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const exercisesTable = pgTable("exercises", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description").notNull(),
  muscleGroups: text("muscle_groups").array().notNull().default([]),
  keyJoints: text("key_joints").array().notNull().default([]),
  difficulty: varchar("difficulty", { length: 20 }).notNull().default("beginner"),
  coachingCues: text("coaching_cues").array().notNull().default([]),
  category: varchar("category", { length: 50 }),
});

export const insertExerciseSchema = createInsertSchema(exercisesTable).omit({ id: true });
export type InsertExercise = z.infer<typeof insertExerciseSchema>;
export type Exercise = typeof exercisesTable.$inferSelect;
