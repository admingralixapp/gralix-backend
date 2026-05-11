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
  /** True when the user has an active Pro subscription (or trial). */
  isPro: boolean("is_pro").notNull().default(false),
  /**
   * When true, a Verified Pro badge appears next to the user's name
   * in the Leaderboard and Community Feed.
   */
  showVerifiedBadge: boolean("show_verified_badge").notNull().default(false),
  /**
   * Array of owned Aura Pack IDs, e.g. ["classic","iron-circuit"].
   * Updated on purchase, promo redemption, and signing bonus claim.
   */
  inventory: jsonb("inventory").notNull().default(["classic"] as string[]),
  /**
   * Currently active aura: { packId, voiceId, skinId }.
   * Drives voice-coaching tone and Ghost Skeleton colour in workouts.
   */
  activeAura: jsonb("active_aura").notNull().default({} as { packId?: string; voiceId?: string; skinId?: string }),
  /**
   * Promo codes already redeemed by this user — prevents double-use.
   */
  redeemedCodes: jsonb("redeemed_codes").notNull().default([] as string[]),
  /**
   * True after the user has claimed their one-time Pro signing bonus pack.
   */
  hasClaimedSigningBonus: boolean("has_claimed_signing_bonus").notNull().default(false),
  /**
   * BCP-47 locale tag for the user's preferred language/regional currency,
   * e.g. "en-GB" (GBP), "en-US" (USD), "fr" (EUR). Null = auto-detect.
   */
  preferredLanguage: varchar("preferred_language", { length: 16 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
