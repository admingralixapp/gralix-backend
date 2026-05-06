import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const BodyCalibrationDataSchema = z.object({
  wingspan:     z.number(),
  height:       z.number(),
  shoulderWidth: z.number(),
  torsoLength:  z.number(),
  legLength:    z.number(),
  capturedAt:   z.string(),
});

router.get("/calibration", async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) return void res.status(401).json({ error: "Unauthorized" });

  const [user] = await db
    .select({ calibrationData: usersTable.calibrationData })
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId));

  if (!user) return void res.status(404).json({ error: "User not found" });

  res.json({ calibrationData: user.calibrationData ?? null });
});

router.post("/calibration", async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) return void res.status(401).json({ error: "Unauthorized" });

  const parsed = BodyCalibrationDataSchema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "Invalid calibration data", details: parsed.error.issues });
  }

  await db
    .update(usersTable)
    .set({ calibrationData: parsed.data })
    .where(eq(usersTable.clerkId, clerkId));

  res.json({ ok: true });
});

export default router;
