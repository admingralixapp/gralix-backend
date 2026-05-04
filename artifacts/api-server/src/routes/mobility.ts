import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, usersTable, mobilityCompletionsTable, userNotificationSettingsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

// ─── Shared helpers ──────────────────────────────────────────────────────────

async function getUserId(clerkId: string): Promise<number | null> {
  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId));
  return user?.id ?? null;
}

function calcStreak(dates: string[]): number {
  const dateSet = new Set(dates);
  let streak = 0;
  const check = new Date();
  check.setHours(0, 0, 0, 0);
  while (dateSet.has(check.toISOString().split("T")[0])) {
    streak++;
    check.setDate(check.getDate() - 1);
  }
  return streak;
}

// ─── GET /mobility/status ────────────────────────────────────────────────────

router.get("/mobility/status", requireAuth, async (req, res) => {
  const clerkId = (req as AuthedRequest).clerkId;
  const userId = await getUserId(clerkId);
  if (!userId) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [settings] = await db
    .select()
    .from(userNotificationSettingsTable)
    .where(eq(userNotificationSettingsTable.userId, userId));

  const completions = await db
    .select({ completedDate: mobilityCompletionsTable.completedDate })
    .from(mobilityCompletionsTable)
    .where(eq(mobilityCompletionsTable.userId, userId))
    .orderBy(desc(mobilityCompletionsTable.completedDate));

  const todayStr = new Date().toISOString().split("T")[0];
  const dates = completions.map((c) => c.completedDate);
  const completedToday = dates.includes(todayStr);
  const currentStreak = calcStreak(dates);

  res.json({
    completedToday,
    currentStreak,
    settings: {
      enabled: settings?.enabled ?? false,
      notificationTime: settings?.notificationTime ?? "08:00",
      mobilityGoal: settings?.mobilityGoal ?? "general",
    },
  });
});

// ─── POST /mobility/complete ─────────────────────────────────────────────────

const CompleteBody = z.object({
  goal: z.string().optional(),
});

router.post("/mobility/complete", requireAuth, async (req, res) => {
  const clerkId = (req as AuthedRequest).clerkId;
  const userId = await getUserId(clerkId);
  if (!userId) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const body = CompleteBody.parse(req.body);
  const todayStr = new Date().toISOString().split("T")[0];

  await db
    .insert(mobilityCompletionsTable)
    .values({
      userId,
      completedDate: todayStr,
      routineGoal: body.goal ?? "general",
    })
    .onConflictDoNothing();

  const completions = await db
    .select({ completedDate: mobilityCompletionsTable.completedDate })
    .from(mobilityCompletionsTable)
    .where(eq(mobilityCompletionsTable.userId, userId))
    .orderBy(desc(mobilityCompletionsTable.completedDate));

  const dates = completions.map((c) => c.completedDate);
  const currentStreak = calcStreak(dates);

  res.json({ completedToday: true, currentStreak });
});

// ─── GET /mobility/settings ──────────────────────────────────────────────────

router.get("/mobility/settings", requireAuth, async (req, res) => {
  const clerkId = (req as AuthedRequest).clerkId;
  const userId = await getUserId(clerkId);
  if (!userId) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [settings] = await db
    .select()
    .from(userNotificationSettingsTable)
    .where(eq(userNotificationSettingsTable.userId, userId));

  res.json({
    enabled: settings?.enabled ?? false,
    notificationTime: settings?.notificationTime ?? "08:00",
    mobilityGoal: settings?.mobilityGoal ?? "general",
  });
});

// ─── POST /mobility/settings ─────────────────────────────────────────────────

const SettingsBody = z.object({
  enabled: z.boolean().optional(),
  notificationTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  mobilityGoal: z.string().optional(),
});

router.post("/mobility/settings", requireAuth, async (req, res) => {
  const clerkId = (req as AuthedRequest).clerkId;
  const userId = await getUserId(clerkId);
  if (!userId) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const body = SettingsBody.parse(req.body);

  const updateValues: Record<string, unknown> = {};
  if (body.enabled !== undefined) updateValues.enabled = body.enabled;
  if (body.notificationTime !== undefined) updateValues.notificationTime = body.notificationTime;
  if (body.mobilityGoal !== undefined) updateValues.mobilityGoal = body.mobilityGoal;

  const [existing] = await db
    .select({ id: userNotificationSettingsTable.id })
    .from(userNotificationSettingsTable)
    .where(eq(userNotificationSettingsTable.userId, userId));

  let result;
  if (existing) {
    [result] = await db
      .update(userNotificationSettingsTable)
      .set(updateValues)
      .where(eq(userNotificationSettingsTable.userId, userId))
      .returning();
  } else {
    [result] = await db
      .insert(userNotificationSettingsTable)
      .values({
        userId,
        enabled: body.enabled ?? false,
        notificationTime: body.notificationTime ?? "08:00",
        mobilityGoal: body.mobilityGoal ?? "general",
      })
      .returning();
  }

  res.json({
    enabled: result?.enabled ?? false,
    notificationTime: result?.notificationTime ?? "08:00",
    mobilityGoal: result?.mobilityGoal ?? "general",
  });
});

export default router;
