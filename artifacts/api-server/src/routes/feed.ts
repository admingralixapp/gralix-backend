import { Router, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  usersTable,
  sessionsTable,
  exercisesTable,
  friendRequestsTable,
  shoutoutsTable,
} from "@workspace/db";
import { eq, and, or, inArray, isNotNull, desc } from "drizzle-orm";
import { getMasteredSkills, type SessionRow } from "../lib/skillTree";

const router = Router();

function getClerkId(req: Request): string | null {
  return (getAuth(req as Parameters<typeof getAuth>[0])?.userId as string | undefined) ?? null;
}

async function getMe(clerkId: string) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId));
  return user ?? null;
}

async function getUserSessions(userId: number): Promise<SessionRow[]> {
  return db
    .select({
      exerciseName: exercisesTable.name,
      totalReps: sessionsTable.totalReps,
      avgFormScore: sessionsTable.avgFormScore,
      completedAt: sessionsTable.completedAt,
    })
    .from(sessionsTable)
    .innerJoin(exercisesTable, eq(sessionsTable.exerciseId, exercisesTable.id))
    .where(
      and(
        eq(sessionsTable.userId, userId),
        isNotNull(sessionsTable.completedAt),
      ),
    );
}

// ---------------------------------------------------------------------------
// GET /api/skills/mastered — current user's mastered skills with full metadata
// ---------------------------------------------------------------------------
router.get("/skills/mastered", async (req: Request, res: Response) => {
  const clerkId = getClerkId(req);
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const me = await getMe(clerkId);
  if (!me) {
    res.json({ mastered: [] });
    return;
  }

  const sessions = await getUserSessions(me.id);
  const mastered = getMasteredSkills(sessions);

  res.json({ mastered });
});

// ---------------------------------------------------------------------------
// POST /api/shoutouts — record an elite mastery shoutout (idempotent)
// ---------------------------------------------------------------------------
router.post("/shoutouts", async (req: Request, res: Response) => {
  const clerkId = getClerkId(req);
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const me = await getMe(clerkId);
  if (!me) {
    res.status(403).json({ error: "Profile required" });
    return;
  }

  const { skillId, skillTitle, branch } = req.body as {
    skillId: string;
    skillTitle: string;
    branch: string;
  };

  if (!skillId || !skillTitle || !branch) {
    res.status(400).json({ error: "Missing fields: skillId, skillTitle, branch" });
    return;
  }

  await db
    .insert(shoutoutsTable)
    .values({ userId: me.id, skillId, skillTitle, branch })
    .onConflictDoNothing();

  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// GET /api/feed — shoutouts from self + friends (latest 30)
// ---------------------------------------------------------------------------
router.get("/feed", async (req: Request, res: Response) => {
  const clerkId = getClerkId(req);
  if (!clerkId) {
    res.json({ entries: [] });
    return;
  }

  const me = await getMe(clerkId);
  if (!me) {
    res.json({ entries: [] });
    return;
  }

  // Collect accepted friend IDs
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
  const visibleUserIds = [me.id, ...friendIds];

  const entries = await db
    .select({
      id: shoutoutsTable.id,
      skillId: shoutoutsTable.skillId,
      skillTitle: shoutoutsTable.skillTitle,
      branch: shoutoutsTable.branch,
      createdAt: shoutoutsTable.createdAt,
      userId: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(shoutoutsTable)
    .innerJoin(usersTable, eq(shoutoutsTable.userId, usersTable.id))
    .where(inArray(shoutoutsTable.userId, visibleUserIds))
    .orderBy(desc(shoutoutsTable.createdAt))
    .limit(30);

  res.json({ entries });
});

export default router;
