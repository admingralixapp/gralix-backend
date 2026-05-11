import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db, sessionsTable, repsTable, exercisesTable, usersTable } from "@workspace/db";
import {
  GetProgressSummaryResponse,
  GetProgressByExerciseResponse,
  GetProgressTimelineQueryParams,
  GetProgressTimelineResponse,
  GetRecentSessionsQueryParams,
  GetRecentSessionsResponse,
} from "@workspace/api-zod";
import { eq, desc, sql, and, gte, or, isNull } from "drizzle-orm";

const router: IRouter = Router();

// ─── Helper: resolve DB user from Clerk auth ──────────────────────────────────

async function resolveUser(req: Parameters<typeof getAuth>[0]) {
  const auth = getAuth(req as any);
  if (!auth?.userId) return { clerkId: null, userId: null };
  const clerkId = auth.userId;
  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId));
  return { clerkId, userId: user?.id ?? null };
}

// Build the user-scoped WHERE condition (same logic as GET /api/sessions).
// Returns sql`1 = 0` for unauthenticated requests (safe default — no data leak).
function buildUserWhere(clerkId: string | null, userId: number | null) {
  const conditions = [];
  if (userId !== null) conditions.push(eq(sessionsTable.userId, userId));
  if (clerkId) conditions.push(and(isNull(sessionsTable.userId), eq(sessionsTable.clerkId, clerkId)));
  // Migration fallback: sessions created before clerkId was tracked
  if (userId !== null || clerkId) {
    conditions.push(and(isNull(sessionsTable.userId), isNull(sessionsTable.clerkId)));
  }
  if (conditions.length === 0) return sql`1 = 0`;
  if (conditions.length === 1) return conditions[0]!;
  return or(...(conditions as [typeof conditions[0], ...typeof conditions]));
}

router.get("/progress/summary", async (_req, res) => {
  const [totals] = await db
    .select({
      totalSessions: sql<number>`count(distinct ${sessionsTable.id})::int`,
      totalReps: sql<number>`coalesce(sum(${sessionsTable.totalReps}), 0)::int`,
      avgFormScore: sql<number | null>`avg(${sessionsTable.avgFormScore})::float`,
      bestFormScore: sql<number | null>`max(${sessionsTable.avgFormScore})::float`,
    })
    .from(sessionsTable)
    .where(sql`${sessionsTable.completedAt} is not null`);

  const sessions = await db
    .select({ startedAt: sessionsTable.startedAt })
    .from(sessionsTable)
    .where(sql`${sessionsTable.completedAt} is not null`)
    .orderBy(desc(sessionsTable.startedAt));

  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daySet = new Set(
    sessions.map((s) => {
      const d = new Date(s.startedAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );
  let checkDate = new Date(today);
  while (daySet.has(checkDate.getTime())) {
    currentStreak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  let improvementPercent: number | null = null;
  if (sessions.length >= 2) {
    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - 14);
    const [recent] = await db
      .select({ avg: sql<number | null>`avg(${sessionsTable.avgFormScore})` })
      .from(sessionsTable)
      .where(and(gte(sessionsTable.startedAt, recentCutoff), sql`${sessionsTable.completedAt} is not null`));
    const [older] = await db
      .select({ avg: sql<number | null>`avg(${sessionsTable.avgFormScore})` })
      .from(sessionsTable)
      .where(and(sql`${sessionsTable.startedAt} < ${recentCutoff.toISOString()}`, sql`${sessionsTable.completedAt} is not null`));
    if (recent?.avg != null && older?.avg != null && older.avg > 0) {
      improvementPercent = ((recent.avg - older.avg) / older.avg) * 100;
    }
  }

  res.json(
    GetProgressSummaryResponse.parse({
      totalSessions: totals?.totalSessions ?? 0,
      totalReps: totals?.totalReps ?? 0,
      avgFormScore: totals?.avgFormScore ?? null,
      bestFormScore: totals?.bestFormScore ?? null,
      currentStreak,
      improvementPercent,
    })
  );
});

router.get("/progress/by-exercise", async (_req, res) => {
  const rows = await db
    .select({
      exerciseId: exercisesTable.id,
      exerciseName: exercisesTable.name,
      totalSessions: sql<number>`count(distinct ${sessionsTable.id})::int`,
      totalReps: sql<number>`coalesce(sum(${sessionsTable.totalReps}), 0)::int`,
      avgFormScore: sql<number | null>`avg(${sessionsTable.avgFormScore})::float`,
      bestFormScore: sql<number | null>`max(${sessionsTable.avgFormScore})::float`,
      lastSessionAt: sql<string | null>`max(${sessionsTable.startedAt})`,
    })
    .from(exercisesTable)
    .leftJoin(sessionsTable, and(eq(sessionsTable.exerciseId, exercisesTable.id), sql`${sessionsTable.completedAt} is not null`))
    .groupBy(exercisesTable.id, exercisesTable.name)
    .orderBy(exercisesTable.name);

  res.json(GetProgressByExerciseResponse.parse(rows));
});

router.get("/progress/timeline", async (req, res) => {
  const { exerciseId, days } = GetProgressTimelineQueryParams.parse(req.query);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days ?? 30));

  const conditions = [
    gte(sessionsTable.startedAt, cutoff),
    sql`${sessionsTable.completedAt} is not null`,
    sql`${sessionsTable.avgFormScore} is not null`,
  ];
  if (exerciseId) conditions.push(eq(sessionsTable.exerciseId, exerciseId));

  const rows = await db
    .select({
      date: sql<string>`date(${sessionsTable.startedAt})`,
      avgFormScore: sql<number>`avg(${sessionsTable.avgFormScore})::float`,
      totalReps: sql<number>`coalesce(sum(${sessionsTable.totalReps}), 0)::int`,
      exerciseId: exercisesTable.id,
      exerciseName: exercisesTable.name,
    })
    .from(sessionsTable)
    .innerJoin(exercisesTable, eq(sessionsTable.exerciseId, exercisesTable.id))
    .where(and(...conditions))
    .groupBy(sql`date(${sessionsTable.startedAt})`, exercisesTable.id, exercisesTable.name)
    .orderBy(sql`date(${sessionsTable.startedAt})`);

  res.json(GetProgressTimelineResponse.parse(rows));
});

// ─── GET /api/progress/recent-sessions ───────────────────────────────────────
// Returns sessions for the authenticated user, ordered newest first.
// Uses the same user-resolution logic as GET /api/sessions so the History
// tab and Dashboard always show the same data for the same user.

router.get("/progress/recent-sessions", async (req, res) => {
  const { limit } = GetRecentSessionsQueryParams.parse(req.query);
  const { clerkId, userId } = await resolveUser(req);
  const userWhere = buildUserWhere(clerkId, userId);

  const rows = await db
    .select({
      id: sessionsTable.id,
      exerciseId: sessionsTable.exerciseId,
      exerciseName: exercisesTable.name,
      startedAt: sessionsTable.startedAt,
      totalReps: sessionsTable.totalReps,
      avgFormScore: sessionsTable.avgFormScore,
      logType: sessionsTable.logType,
      isVerified: sessionsTable.isVerified,
      durationMinutes: sql<number | null>`
        case when ${sessionsTable.completedAt} is not null
        then (extract(epoch from (${sessionsTable.completedAt} - ${sessionsTable.startedAt})) / 60)::float
        else null end
      `,
    })
    .from(sessionsTable)
    .innerJoin(exercisesTable, eq(sessionsTable.exerciseId, exercisesTable.id))
    .where(and(userWhere, eq(sessionsTable.source, "workout")))
    .orderBy(desc(sessionsTable.startedAt))
    .limit(limit);

  res.set("Cache-Control", "no-store");
  res.json(GetRecentSessionsResponse.parse(rows));
});

export default router;
