import { Router, type IRouter } from "express";
import { db, repsTable } from "@workspace/db";
import {
  CreateRepBody,
  CreateRepParams,
  ListRepsParams,
  ListRepsResponse,
} from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/sessions/:sessionId/reps", async (req, res) => {
  const { sessionId } = ListRepsParams.parse(req.params);
  const reps = await db
    .select()
    .from(repsTable)
    .where(eq(repsTable.sessionId, sessionId))
    .orderBy(repsTable.repNumber);
  res.json(ListRepsResponse.parse(reps));
});

router.post("/sessions/:sessionId/reps", async (req, res) => {
  const { sessionId } = CreateRepParams.parse(req.params);
  const body = CreateRepBody.parse(req.body);
  const [rep] = await db
    .insert(repsTable)
    .values({
      sessionId,
      repNumber: body.repNumber,
      formScore: body.formScore,
      durationMs: body.durationMs ?? null,
      feedbackGiven: body.feedbackGiven ?? null,
    })
    .returning();
  res.status(201).json(rep);
});

export default router;
