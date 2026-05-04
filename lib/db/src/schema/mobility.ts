import {
  pgTable,
  serial,
  integer,
  boolean,
  varchar,
  date,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const mobilityCompletionsTable = pgTable(
  "mobility_completions",
  {
    id:            serial("id").primaryKey(),
    userId:        integer("user_id").notNull().references(() => usersTable.id),
    completedDate: date("completed_date").notNull(),
    routineGoal:   varchar("routine_goal", { length: 64 }),
    createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("mobility_completions_user_date_idx").on(table.userId, table.completedDate),
  ],
);

export const userNotificationSettingsTable = pgTable("user_notification_settings", {
  id:               serial("id").primaryKey(),
  userId:           integer("user_id").notNull().references(() => usersTable.id).unique(),
  enabled:          boolean("enabled").notNull().default(false),
  notificationTime: varchar("notification_time", { length: 5 }).notNull().default("08:00"),
  mobilityGoal:     varchar("mobility_goal", { length: 64 }).notNull().default("general"),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMobilityCompletionSchema = createInsertSchema(mobilityCompletionsTable).omit({
  id: true,
  userId: true,
  createdAt: true,
});
export type InsertMobilityCompletion = z.infer<typeof insertMobilityCompletionSchema>;
export type MobilityCompletion = typeof mobilityCompletionsTable.$inferSelect;

export const insertUserNotificationSettingsSchema = createInsertSchema(userNotificationSettingsTable).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserNotificationSettings = z.infer<typeof insertUserNotificationSettingsSchema>;
export type UserNotificationSettings = typeof userNotificationSettingsTable.$inferSelect;
