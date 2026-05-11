import { Router, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  usersTable,
  friendRequestsTable,
  sessionsTable,
  exercisesTable,
  leaderboardSnapshotsTable,
} from "@workspace/db";
import { eq, and, or, inArray, isNotNull, desc } from "drizzle-orm";
import { computeMasteryPoints, type SessionRow } from "../lib/skillTree";
import {
  getCurrentPeriodStart,
  nextWeeklyResetAfter,
  nextMonthlyResetAfter,
} from "../lib/leaderboardReset";

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getClerkId(req: Request): string | null {
  return (getAuth(req as any)?.userId as string | undefined) ?? null;
}

async function getMe(clerkId: string) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId));
  return user ?? null;
}

/** Detect ISO-3166-1 alpha-2 country code from request headers. */
function detectCountry(req: Request): string | null {
  const cf = req.headers["cf-ipcountry"] as string | undefined;
  if (cf && cf.length === 2 && !["XX", "T1"].includes(cf)) {
    return cf.toUpperCase();
  }
  const lang = req.headers["accept-language"] as string | undefined;
  if (lang) {
    const match = lang.match(/[a-z]{2}-([A-Z]{2})/i);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

// ---------------------------------------------------------------------------
// GET /api/leaderboard/reset-info
// Returns the next reset timestamps for weekly and monthly cycles.
// ---------------------------------------------------------------------------
router.get("/leaderboard/reset-info", async (_req: Request, res: Response) => {
  const [weeklyStart, monthlyStart] = await Promise.all([
    getCurrentPeriodStart("weekly"),
    getCurrentPeriodStart("monthly"),
  ]);

  const now = new Date();
  const weeklyPeriodStart = weeklyStart ?? now;
  const monthlyPeriodStart = monthlyStart ?? now;

  res.json({
    weeklyPeriodStart: weeklyPeriodStart.toISOString(),
    monthlyPeriodStart: monthlyPeriodStart.toISOString(),
    weeklyNextReset: nextWeeklyResetAfter(weeklyPeriodStart).toISOString(),
    monthlyNextReset: nextMonthlyResetAfter(monthlyPeriodStart).toISOString(),
  });
});

// ---------------------------------------------------------------------------
// GET /api/leaderboard/:type/history   — previous winners (snapshots)
// Query params: ?periodType=weekly|monthly  (default: weekly)  &limit=5
// ---------------------------------------------------------------------------
router.get(
  "/leaderboard/:type/history",
  async (req: Request, res: Response) => {
    const type = req.params.type as "global" | "national" | "friends";
    if (!["global", "national", "friends"].includes(type)) {
      res.status(400).json({ error: "Invalid leaderboard type" });
      return;
    }

    const periodType = req.query.periodType === "monthly" ? "monthly" : "weekly";
    const limit = Math.min(10, Math.max(1, Number(req.query.limit ?? 5)));

    const snapshots = await db
      .select()
      .from(leaderboardSnapshotsTable)
      .where(eq(leaderboardSnapshotsTable.periodType, periodType))
      .orderBy(desc(leaderboardSnapshotsTable.periodEnd))
      .limit(limit);

    res.json({ snapshots });
  },
);

// ---------------------------------------------------------------------------
// GET /api/leaderboard/:type   type = global | national | friends
// Query params: ?period=weekly|monthly  (default: weekly)
// ---------------------------------------------------------------------------
router.get(
  "/leaderboard/:type",
  async (req: Request, res: Response) => {
    const type = req.params.type as "global" | "national" | "friends";

    if (!["global", "national", "friends"].includes(type)) {
      res.status(400).json({ error: "Invalid leaderboard type" });
      return;
    }

    const periodType = req.query.period === "monthly" ? "monthly" : "weekly";
    const clerkId = getClerkId(req);
    const me = clerkId ? await getMe(clerkId) : null;

    if (type === "friends") {
      if (!me) {
        res.status(401).json({ error: "Sign in to view the friends leaderboard" });
        return;
      }
    }

    // Fetch the competitive period start (null = all-time, used as fallback)
    const periodStart = await getCurrentPeriodStart(periodType);

    // ── Determine which user IDs are in scope ──────────────────────────────
    let relevantUserIds: number[] | null = null;
    let country: string | null = null;

    if (type === "friends" && me) {
      const friendRows = await db
        .select({
          fromUserId: friendRequestsTable.fromUserId,
          toUserId: friendRequestsTable.toUserId,
        })
        .from(friendRequestsTable)
        .where(
          and(
            eq(friendRequestsTable.status, "accepted"),
            or(
              eq(friendRequestsTable.fromUserId, me.id),
              eq(friendRequestsTable.toUserId, me.id),
            ),
          ),
        );

      const friendIds = friendRows.map((r) =>
        r.fromUserId === me.id ? r.toUserId : r.fromUserId,
      );
      relevantUserIds = [me.id, ...friendIds];
    } else if (type === "national") {
      country = (me as any)?.country ?? detectCountry(req);
      if (!country) {
        res.json({
          entries: [],
          myRank: null,
          myPoints: 0,
          myMasteredSkills: 0,
          country: null,
          periodType,
          periodStart: periodStart?.toISOString() ?? null,
        });
        return;
      }
      const usersInCountry = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.country, country));

      relevantUserIds = usersInCountry.map((u) => u.id);
      if (relevantUserIds.length === 0) {
        res.json({
          entries: [],
          myRank: null,
          myPoints: 0,
          myMasteredSkills: 0,
          country,
          periodType,
          periodStart: periodStart?.toISOString() ?? null,
        });
        return;
      }
    }

    // ── Fetch sessions ─────────────────────────────────────────────────────
    type SessionResult = SessionRow & { userId: number | null };
    let allSessions: SessionResult[];

    const sessionCols = {
      userId: sessionsTable.userId,
      exerciseName: exercisesTable.name,
      totalReps: sessionsTable.totalReps,
      avgFormScore: sessionsTable.avgFormScore,
      completedAt: sessionsTable.completedAt,
      isVerified: sessionsTable.isVerified,
    } as const;

    if (relevantUserIds !== null) {
      allSessions = await db
        .select(sessionCols)
        .from(sessionsTable)
        .innerJoin(exercisesTable, eq(sessionsTable.exerciseId, exercisesTable.id))
        .where(
          and(
            isNotNull(sessionsTable.userId),
            inArray(sessionsTable.userId, relevantUserIds),
          ),
        );
    } else {
      allSessions = await db
        .select(sessionCols)
        .from(sessionsTable)
        .innerJoin(exercisesTable, eq(sessionsTable.exerciseId, exercisesTable.id))
        .where(isNotNull(sessionsTable.userId));
    }

    // ── Fetch users ────────────────────────────────────────────────────────
    const allUsers =
      relevantUserIds !== null
        ? await db
            .select()
            .from(usersTable)
            .where(inArray(usersTable.id, relevantUserIds))
        : await db.select().from(usersTable);

    // ── Group sessions by userId ───────────────────────────────────────────
    const sessionsByUser = new Map<number, SessionRow[]>();
    for (const s of allSessions) {
      if (s.userId == null) continue;
      const bucket = sessionsByUser.get(s.userId) ?? [];
      bucket.push(s);
      sessionsByUser.set(s.userId, bucket);
    }

    // ── Compute mastery & rank (period-filtered points, all-time mastery) ─
    const ranked = allUsers
      .map((user) => {
        const sessions = sessionsByUser.get(user.id) ?? [];
        const { points, masteredCount } = computeMasteryPoints(
          sessions,
          periodStart ?? undefined,
        );
        return { ...user, masteryPoints: points, masteredSkills: masteredCount };
      })
      .sort(
        (a, b) =>
          b.masteryPoints - a.masteryPoints ||
          b.masteredSkills - a.masteredSkills ||
          a.id - b.id,
      );

    const myIndex = me ? ranked.findIndex((u) => u.id === me.id) : -1;
    const myRank = myIndex >= 0 ? myIndex + 1 : null;
    const myEntry = myIndex >= 0 ? ranked[myIndex] : null;

    // Friends tab shows every friend; global/national capped at Top 100
    const topN = type === "friends" ? ranked.length : 100;

    const entries = ranked.slice(0, topN).map((u, i) => ({
      rank: i + 1,
      userId: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      country: (u as any).country ?? null,
      masteryPoints: u.masteryPoints,
      masteredSkills: u.masteredSkills,
      showVerifiedBadge: (u as any).showVerifiedBadge ?? false,
    }));

    res.json({
      entries,
      myRank,
      myPoints: myEntry?.masteryPoints ?? 0,
      myMasteredSkills: myEntry?.masteredSkills ?? 0,
      leaderPoints: ranked[0]?.masteryPoints ?? 0,
      country: type === "national" ? country : null,
      periodType,
      periodStart: periodStart?.toISOString() ?? null,
    });
  },
);

export default router;
