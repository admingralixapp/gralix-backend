import { Router, type IRouter } from "express";
import { db, sessionsTable, repsTable, exercisesTable } from "@workspace/db";
import {
  GetProgressSummaryResponse,
  GetProgressByExerciseResponse,
  GetProgressTimelineQueryParams,
  GetProgressTimelineResponse,
  GetRecentSessionsQueryParams,
  GetRecentSessionsResponse,
} from "@workspace/api-zod";
import { eq, desc, sql, and, gte } from "drizzle-orm";

const router: IRouter = Router();

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

router.get("/progress/recent-sessions", async (req, res) => {
  const { limit } = GetRecentSessionsQueryParams.parse(req.query);
  const rows = await db
    .select({
      id: sessionsTable.id,
      exerciseId: sessionsTable.exerciseId,
      exerciseName: exercisesTable.name,
      startedAt: sessionsTable.startedAt,
      totalReps: sessionsTable.totalReps,
      avgFormScore: sessionsTable.avgFormScore,
      logType: sessionsTable.logType,
      durationMinutes: sql<number | null>`
        case when ${sessionsTable.completedAt} is not null
        then (extract(epoch from (${sessionsTable.completedAt} - ${sessionsTable.startedAt})) / 60)::float
        else null end
      `,
    })
    .from(sessionsTable)
    .innerJoin(exercisesTable, eq(sessionsTable.exerciseId, exercisesTable.id))
    .orderBy(desc(sessionsTable.startedAt))
    .limit(limit ?? 5);

  res.json(GetRecentSessionsResponse.parse(rows));
});

export default router;
