import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db, sessionsTable, exercisesTable, repsTable, usersTable } from "@workspace/db";
import {
  CreateSessionBody,
  GetSessionParams,
  GetSessionResponse,
  ListSessionsQueryParams,
  ListSessionsResponse,
  UpdateSessionBody,
  UpdateSessionParams,
  UpdateSessionResponse,
} from "@workspace/api-zod";
import { eq, desc, or, and, isNull, sql } from "drizzle-orm";
import {
  getExerciseCategory,
  getNewlyEarnedBadgeIds,
  computeLifetimeRepsFromSessions,
  computeEarnedBadgeIds,
  MILESTONE_BADGE_MAP,
  type MilestoneCategory,
} from "../lib/milestoneBadges";
import {
  getExerciseMasteryDef,
  getNewlyEarnedExerciseTiers,
  getTierTitle,
  TIER_LABELS,
  type ExerciseStatsMap,
} from "../lib/exerciseMastery";

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

// ─── GET /api/sessions ────────────────────────────────────────────────────────
// Returns sessions for the authenticated user only.
// Matches by userId first, then falls back to clerkId (for sessions created
// before the user profile existed).

router.get("/sessions", async (req, res) => {
  const { limit, offset } = ListSessionsQueryParams.parse(req.query);
  const { clerkId, userId } = await resolveUser(req);

  // Build where clause: match by DB userId OR by clerkId (for pre-profile sessions)
  // Also include fully-unclaimed (userId IS NULL AND clerkId IS NULL) as migration fallback
  const conditions = [];
  if (userId !== null) conditions.push(eq(sessionsTable.userId, userId));
  if (clerkId) conditions.push(and(isNull(sessionsTable.userId), eq(sessionsTable.clerkId, clerkId)));
  // Migration fallback: sessions created before clerkId was tracked
  if (userId !== null || clerkId) {
    conditions.push(and(isNull(sessionsTable.userId), isNull(sessionsTable.clerkId)));
  }

  const whereClause = conditions.length === 0
    ? sql`1 = 0` // unauthenticated → no sessions
    : conditions.length === 1
      ? conditions[0]!
      : or(...(conditions as [typeof conditions[0], ...typeof conditions]));

  const sessions = await db
    .select({
      id: sessionsTable.id,
      exerciseId: sessionsTable.exerciseId,
      exerciseName: exercisesTable.name,
      startedAt: sessionsTable.startedAt,
      completedAt: sessionsTable.completedAt,
      totalReps: sessionsTable.totalReps,
      avgFormScore: sessionsTable.avgFormScore,
      notes: sessionsTable.notes,
      logType: sessionsTable.logType,
      rpe: sessionsTable.rpe,
      isVerified: sessionsTable.isVerified,
      source: sessionsTable.source,
      sets: sessionsTable.sets,
    })
    .from(sessionsTable)
    .innerJoin(exercisesTable, eq(sessionsTable.exerciseId, exercisesTable.id))
    .where(and(whereClause, eq(sessionsTable.source, "workout")))
    .orderBy(desc(sessionsTable.startedAt))
    .limit(limit ?? 20)
    .offset(offset ?? 0);

  res.set("Cache-Control", "no-store");
  res.json(ListSessionsResponse.parse(sessions));
});

// ─── POST /api/sessions ───────────────────────────────────────────────────────

router.post("/sessions", async (req, res) => {
  const body = CreateSessionBody.parse(req.body);
  const { clerkId, userId } = await resolveUser(req);

  const [session] = await db
    .insert(sessionsTable)
    .values({
      exerciseId: body.exerciseId,
      notes: body.notes ?? null,
      logType: body.logType ?? "ai",
      userId,
      clerkId,
    })
    .returning();
  const [exercise] = await db
    .select({ name: exercisesTable.name })
    .from(exercisesTable)
    .where(eq(exercisesTable.id, session!.exerciseId));
  res.status(201).json({
    ...session,
    exerciseName: exercise?.name ?? "",
  });
});

// ─── GET /api/sessions/:id ────────────────────────────────────────────────────

router.get("/sessions/:id", async (req, res) => {
  const { id } = GetSessionParams.parse(req.params);
  const [session] = await db
    .select({
      id: sessionsTable.id,
      exerciseId: sessionsTable.exerciseId,
      exerciseName: exercisesTable.name,
      startedAt: sessionsTable.startedAt,
      completedAt: sessionsTable.completedAt,
      totalReps: sessionsTable.totalReps,
      avgFormScore: sessionsTable.avgFormScore,
      notes: sessionsTable.notes,
      logType: sessionsTable.logType,
      rpe: sessionsTable.rpe,
      isVerified: sessionsTable.isVerified,
      source: sessionsTable.source,
      sets: sessionsTable.sets,
    })
    .from(sessionsTable)
    .innerJoin(exercisesTable, eq(sessionsTable.exerciseId, exercisesTable.id))
    .where(eq(sessionsTable.id, id));
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const reps = await db
    .select()
    .from(repsTable)
    .where(eq(repsTable.sessionId, id))
    .orderBy(repsTable.repNumber);

  res.json(GetSessionResponse.parse({ ...session, reps }));
});

// ─── PATCH /api/sessions/:id ──────────────────────────────────────────────────
// When a session is completed (completedAt set), also updates the user's
// lifetime rep totals and milestone badge list.

router.patch("/sessions/:id", async (req, res) => {
  const { id } = UpdateSessionParams.parse(req.params);
  const body = UpdateSessionBody.parse(req.body);
  const updateData: Record<string, unknown> = {};
  if (body.completedAt !== undefined) updateData.completedAt = body.completedAt;
  if (body.totalReps !== undefined) updateData.totalReps = body.totalReps;
  if (body.avgFormScore !== undefined) updateData.avgFormScore = body.avgFormScore;
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.rpe !== undefined) updateData.rpe = body.rpe;
  if (body.isVerified !== undefined) updateData.isVerified = body.isVerified;
  if (body.sets !== undefined) updateData.sets = body.sets;

  const [updated] = await db
    .update(sessionsTable)
    .set(updateData)
    .where(eq(sessionsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Session not found" }); return; }

  const [exercise] = await db
    .select({ name: exercisesTable.name })
    .from(exercisesTable)
    .where(eq(exercisesTable.id, updated.exerciseId));

  const exerciseName = exercise?.name ?? "";

  // ── Update lifetime reps + badges + exerciseStats if session is being completed ──
  let newBadges: { id: string; name: string; icon: string; category: string; tier: string }[] = [];
  let newExerciseTiers: { exerciseName: string; tier: string; title: string; icon: string }[] = [];

  if (body.completedAt && updated.userId && (body.totalReps ?? 0) > 0) {
    const [user] = await db
      .select({
        lifetimeRepsPush: usersTable.lifetimeRepsPush,
        lifetimeRepsPull: usersTable.lifetimeRepsPull,
        lifetimeRepsCore: usersTable.lifetimeRepsCore,
        lifetimeRepsLegs: usersTable.lifetimeRepsLegs,
        earnedMilestoneBadges: usersTable.earnedMilestoneBadges,
        exerciseStats: usersTable.exerciseStats,
      })
      .from(usersTable)
      .where(eq(usersTable.id, updated.userId));

    if (user) {
      const addedReps = body.totalReps ?? 0;
      const userUpdate: Record<string, unknown> = {};

      // ── Category milestone badges ──
      const cat: MilestoneCategory | null = getExerciseCategory(exerciseName);
      if (cat) {
        const colKey = `lifetimeReps${cat.charAt(0).toUpperCase()}${cat.slice(1)}` as
          | "lifetimeRepsPush"
          | "lifetimeRepsPull"
          | "lifetimeRepsCore"
          | "lifetimeRepsLegs";
        const currentReps = (user[colKey] ?? 0) as number;
        const newReps     = currentReps + addedReps;
        const newBadgeIds = getNewlyEarnedBadgeIds(cat, currentReps, newReps);
        const currentBadges = (user.earnedMilestoneBadges as string[]) ?? [];
        userUpdate[colKey] = newReps;
        userUpdate.earnedMilestoneBadges = [...new Set([...currentBadges, ...newBadgeIds])];
        newBadges = newBadgeIds.flatMap((bid) => {
          const def = MILESTONE_BADGE_MAP.get(bid);
          return def ? [{ id: def.id, name: def.name, icon: def.icon, category: def.category, tier: def.tier }] : [];
        });
      }

      // ── Per-exercise mastery ──
      const exerciseDef = getExerciseMasteryDef(exerciseName);
      if (exerciseDef) {
        const currentStats = (user.exerciseStats as ExerciseStatsMap) ?? {};
        const oldTotal = currentStats[exerciseName]?.total ?? 0;
        const newTotal = oldTotal + addedReps;
        userUpdate.exerciseStats = {
          ...currentStats,
          [exerciseName]: { total: newTotal },
        };
        const newTiers = getNewlyEarnedExerciseTiers(oldTotal, newTotal);
        newExerciseTiers = newTiers.map((tier) => ({
          exerciseName,
          tier: TIER_LABELS[tier],
          title: getTierTitle(exerciseDef, tier),
          icon: exerciseDef.icon,
        }));
      }

      await db.update(usersTable).set(userUpdate).where(eq(usersTable.id, updated.userId));
    }
  }

  res.json({
    ...UpdateSessionResponse.parse({ ...updated, exerciseName }),
    newBadges,
    newExerciseTiers,
  });
});

export default router;
