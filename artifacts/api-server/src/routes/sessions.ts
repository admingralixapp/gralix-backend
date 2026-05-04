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
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/sessions", async (req, res) => {
  const { limit, offset } = ListSessionsQueryParams.parse(req.query);
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
    })
    .from(sessionsTable)
    .innerJoin(exercisesTable, eq(sessionsTable.exerciseId, exercisesTable.id))
    .orderBy(desc(sessionsTable.startedAt))
    .limit(limit ?? 20)
    .offset(offset ?? 0);
  res.json(ListSessionsResponse.parse(sessions));
});

router.post("/sessions", async (req, res) => {
  const body = CreateSessionBody.parse(req.body);

  // Associate with authenticated user if possible
  let userId: number | null = null;
  try {
    const auth = getAuth(req as any);
    if (auth?.userId) {
      const [user] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.clerkId, auth.userId));
      userId = user?.id ?? null;
    }
  } catch {
    // unauthenticated — fine
  }

  const [session] = await db
    .insert(sessionsTable)
    .values({ exerciseId: body.exerciseId, notes: body.notes ?? null, userId })
    .returning();
  const [exercise] = await db
    .select({ name: exercisesTable.name })
    .from(exercisesTable)
    .where(eq(exercisesTable.id, session.exerciseId));
  res.status(201).json({
    ...session,
    exerciseName: exercise?.name ?? "",
  });
});

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

router.patch("/sessions/:id", async (req, res) => {
  const { id } = UpdateSessionParams.parse(req.params);
  const body = UpdateSessionBody.parse(req.body);
  const updateData: Record<string, unknown> = {};
  if (body.completedAt !== undefined) updateData.completedAt = body.completedAt;
  if (body.totalReps !== undefined) updateData.totalReps = body.totalReps;
  if (body.avgFormScore !== undefined) updateData.avgFormScore = body.avgFormScore;
  if (body.notes !== undefined) updateData.notes = body.notes;

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

  res.json(UpdateSessionResponse.parse({ ...updated, exerciseName: exercise?.name ?? "" }));
});

export default router;
