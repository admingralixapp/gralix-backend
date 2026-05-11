/**
 * Competitive Reset Cycle Scheduler
 *
 * Weekly  — resets every Sunday at 23:59:59 UTC
 * Monthly — resets on the last day of each month at 23:59:59 UTC
 *
 * On each reset:
 *   1. The top-50 standings are archived to `leaderboard_snapshots`.
 *   2. The period start in `leaderboard_periods` is advanced to now, so the
 *      next leaderboard query only counts sessions from that point forward.
 */

import { db } from "@workspace/db";
import {
  leaderboardPeriodsTable,
  leaderboardSnapshotsTable,
  sessionsTable,
  exercisesTable,
  usersTable,
  type LeaderboardSnapshotEntry,
} from "@workspace/db";
import { eq, isNotNull } from "drizzle-orm";
import { computeMasteryPoints, type SessionRow } from "./skillTree";
import { logger } from "./logger";

type PeriodType = "weekly" | "monthly";

// ─── UTC helpers ─────────────────────────────────────────────────────────────

/** Next Sunday 23:59:59 UTC strictly after `from`. */
export function nextWeeklyResetAfter(from: Date): Date {
  const day = from.getUTCDay(); // 0 = Sunday
  const daysToAdd = day === 0 ? 7 : 7 - day;
  return new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth(),
      from.getUTCDate() + daysToAdd,
      23, 59, 59, 0,
    ),
  );
}

/** Last day of month 23:59:59 UTC strictly after `from`. */
export function nextMonthlyResetAfter(from: Date): Date {
  // Last day of the same month
  const lastDayCurr = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0, 23, 59, 59, 0),
  );
  if (lastDayCurr > from) return lastDayCurr;
  // Otherwise last day of next month
  return new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 2, 0, 23, 59, 59, 0),
  );
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function getPeriodStart(periodType: PeriodType): Promise<Date | null> {
  const rows = await db
    .select()
    .from(leaderboardPeriodsTable)
    .where(eq(leaderboardPeriodsTable.periodType, periodType));
  return rows[0]?.currentPeriodStart ?? null;
}

async function setPeriodStart(periodType: PeriodType, start: Date): Promise<void> {
  const existing = await getPeriodStart(periodType);
  if (existing == null) {
    await db.insert(leaderboardPeriodsTable).values({
      periodType,
      currentPeriodStart: start,
      updatedAt: new Date(),
    });
  } else {
    await db
      .update(leaderboardPeriodsTable)
      .set({ currentPeriodStart: start, updatedAt: new Date() })
      .where(eq(leaderboardPeriodsTable.periodType, periodType));
  }
}

// ─── Snapshot helper ─────────────────────────────────────────────────────────

async function archiveSnapshot(
  periodType: PeriodType,
  periodStart: Date,
  periodEnd: Date,
): Promise<void> {
  // Fetch all sessions + users to compute standings
  const sessionCols = {
    userId: sessionsTable.userId,
    exerciseName: exercisesTable.name,
    totalReps: sessionsTable.totalReps,
    avgFormScore: sessionsTable.avgFormScore,
    completedAt: sessionsTable.completedAt,
    isVerified: sessionsTable.isVerified,
  } as const;

  const allSessions = await db
    .select(sessionCols)
    .from(sessionsTable)
    .innerJoin(exercisesTable, eq(sessionsTable.exerciseId, exercisesTable.id))
    .where(isNotNull(sessionsTable.userId));

  const allUsers = await db.select().from(usersTable);

  // Group sessions by userId
  const sessionsByUser = new Map<number, SessionRow[]>();
  for (const s of allSessions) {
    if (s.userId == null) continue;
    const bucket = sessionsByUser.get(s.userId) ?? [];
    bucket.push(s);
    sessionsByUser.set(s.userId, bucket);
  }

  // Rank using period-filtered points
  const ranked = allUsers
    .map((user) => {
      const sessions = sessionsByUser.get(user.id) ?? [];
      const { points, masteredCount } = computeMasteryPoints(sessions, periodStart);
      return {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl ?? null,
        country: (user as Record<string, unknown>).country as string | null ?? null,
        masteryPoints: points,
        masteredSkills: masteredCount,
        showVerifiedBadge: (user as Record<string, unknown>).showVerifiedBadge as boolean ?? false,
      };
    })
    .filter((u) => u.masteryPoints > 0)
    .sort(
      (a, b) =>
        b.masteryPoints - a.masteryPoints ||
        b.masteredSkills - a.masteredSkills ||
        a.userId - b.userId,
    );

  const top50: LeaderboardSnapshotEntry[] = ranked.slice(0, 50).map((u, i) => ({
    rank: i + 1,
    ...u,
  }));

  if (top50.length === 0) {
    logger.info({ periodType }, "No entries to snapshot — skipping archive");
    return;
  }

  await db.insert(leaderboardSnapshotsTable).values({
    periodType,
    periodStart,
    periodEnd,
    entries: top50,
    createdAt: new Date(),
  });

  logger.info(
    { periodType, entries: top50.length, winner: top50[0]?.username },
    "Leaderboard snapshot archived",
  );
}

// ─── Reset logic ─────────────────────────────────────────────────────────────

async function maybeReset(periodType: PeriodType, now: Date): Promise<void> {
  let periodStart = await getPeriodStart(periodType);

  if (periodStart == null) {
    // First boot — initialise to a sensible starting point
    periodStart =
      periodType === "weekly"
        ? // Start of the most recent Sunday-to-Sunday cycle
          new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - now.getUTCDay(), 0, 0, 0),
          )
        : // Start of the current month
          new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    await setPeriodStart(periodType, periodStart);
    logger.info({ periodType, periodStart }, "Initialised leaderboard period");
    return;
  }

  const nextReset =
    periodType === "weekly"
      ? nextWeeklyResetAfter(periodStart)
      : nextMonthlyResetAfter(periodStart);

  if (now < nextReset) return; // Not yet time

  logger.info({ periodType, nextReset }, "Performing leaderboard reset");

  // Archive before advancing
  await archiveSnapshot(periodType, periodStart, now);

  // Advance period start to NOW so future queries only count new sessions
  await setPeriodStart(periodType, now);

  logger.info({ periodType }, "Leaderboard period advanced");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Start the background cron-like scheduler (non-blocking). */
export function startResetScheduler(): void {
  // Check immediately on startup
  void (async () => {
    try {
      const now = new Date();
      await maybeReset("weekly", now);
      await maybeReset("monthly", now);
    } catch (err) {
      logger.error({ err }, "Leaderboard reset check failed on startup");
    }
  })();

  // Then every 60 seconds
  setInterval(async () => {
    try {
      const now = new Date();
      await maybeReset("weekly", now);
      await maybeReset("monthly", now);
    } catch (err) {
      logger.error({ err }, "Leaderboard reset check failed");
    }
  }, 60_000);
}

/** Expose the period-start lookup for use by the leaderboard route. */
export async function getCurrentPeriodStart(periodType: PeriodType): Promise<Date | null> {
  return getPeriodStart(periodType);
}
