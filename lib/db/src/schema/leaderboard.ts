import { pgTable, serial, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";

export interface LeaderboardSnapshotEntry {
  rank: number;
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  country: string | null;
  masteryPoints: number;
  masteredSkills: number;
  showVerifiedBadge: boolean;
}

/**
 * Archived leaderboard standings — snapshotted immediately before each
 * weekly / monthly reset so previous winners remain queryable.
 */
export const leaderboardSnapshotsTable = pgTable("leaderboard_snapshots", {
  id:          serial("id").primaryKey(),
  periodType:  varchar("period_type",  { length: 16 }).notNull(), // "weekly" | "monthly"
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd:   timestamp("period_end",   { withTimezone: true }).notNull(),
  /** Top-50 entries at the time of the reset. */
  entries:     jsonb("entries").notNull().$type<LeaderboardSnapshotEntry[]>(),
  createdAt:   timestamp("created_at",   { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per period type — records when the current competitive period began.
 * Upserted on every reset; used to filter sessions for leaderboard scoring.
 */
export const leaderboardPeriodsTable = pgTable("leaderboard_periods", {
  id:                 serial("id").primaryKey(),
  periodType:         varchar("period_type", { length: 16 }).notNull(),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
