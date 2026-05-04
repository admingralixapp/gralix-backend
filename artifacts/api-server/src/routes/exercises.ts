import { Router, type IRouter } from "express";
import { db, exercisesTable } from "@workspace/db";
import { GetExerciseParams, GetExerciseResponse, ListExercisesResponse } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/exercises", async (req, res) => {
  const exercises = await db.select().from(exercisesTable).orderBy(exercisesTable.id);
  const data = ListExercisesResponse.parse(exercises);
  res.json(data);
});

router.get("/exercises/:id", async (req, res) => {
  const { id } = GetExerciseParams.parse(req.params);
  const [exercise] = await db.select().from(exercisesTable).where(eq(exercisesTable.id, id));
  if (!exercise) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }
  const data = GetExerciseResponse.parse(exercise);
  res.json(data);
});

export default router;
