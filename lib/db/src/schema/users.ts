import {
  pgTable,
  serial,
  varchar,
  timestamp,
  text,
  jsonb,
  boolean,
  integer,
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
  /** ISO 3166-1 alpha-2 country code, e.g. "US", "GB" — detected on profile create */
  country:      varchar("country",       { length: 2   }),
  /** Saved body proportions from the one-time global calibration screen. */
  calibrationData: jsonb("calibration_data"),
  /**
   * When true (default), the user's community-feed posts are visible to everyone.
   * When false, posts are only visible to the user's friends in the community feed.
   */
  communityPostsPublic: boolean("community_posts_public").notNull().default(true),
  /** Lifetime rep totals by movement category — updated after every session */
  lifetimeRepsPush: integer("lifetime_reps_push").notNull().default(0),
  lifetimeRepsPull: integer("lifetime_reps_pull").notNull().default(0),
  lifetimeRepsCore: integer("lifetime_reps_core").notNull().default(0),
  lifetimeRepsLegs: integer("lifetime_reps_legs").notNull().default(0),
  /**
   * Array of earned milestone badge IDs, e.g. ["push-bronze","pull-silver"].
   * Updated server-side whenever a lifetime rep milestone is crossed.
   */
  earnedMilestoneBadges: jsonb("earned_milestone_badges").notNull().default([]),
  /**
   * Per-exercise totals: Record<exerciseName, { total: number }>.
   * `total` stores reps for dynamic exercises, seconds for static holds.
   * Incremented after every completed session.
   */
  exerciseStats: jsonb("exercise_stats").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
