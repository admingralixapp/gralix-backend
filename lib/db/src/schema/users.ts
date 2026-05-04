import {
  pgTable,
  serial,
  varchar,
  timestamp,
  text,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** One row per Clerk user — created on first sign-in. */
export const usersTable = pgTable("users", {
  id:           serial("id").primaryKey(),
  clerkId:      varchar("clerk_id",      { length: 255 }).notNull().unique(),
  username:     varchar("username",      { length: 64  }).notNull().unique(),
  displayName:  varchar("display_name",  { length: 128 }).notNull(),
  avatarUrl:    text("avatar_url"),
  /** "public" | "friends" | "private" */
  privacyLevel: varchar("privacy_level", { length: 16  }).notNull().default("friends"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
