import { Router, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  usersTable,
  friendRequestsTable,
  sessionsTable,
  exercisesTable,
} from "@workspace/db";
import { eq, ilike, or, and, desc, inArray, isNotNull, isNull } from "drizzle-orm";
import { computeMasteryPoints, type SessionRow } from "../lib/skillTree";
import {
  computeLifetimeRepsFromSessions,
  computeEarnedBadgeIds,
} from "../lib/milestoneBadges";
import {
  computeExerciseStatsFromSessions,
  type ExerciseStatsMap,
} from "../lib/exerciseMastery";

const router = Router();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function getClerkId(req: Request): string | null {
  const auth = getAuth(req as any);
  return auth?.userId ?? null;
}

async function getMe(clerkId: string) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId));
  return user ?? null;
}

function requireAuthMiddleware(
  req: Request,
  res: Response,
  next: () => void,
): void {
  const clerkId = getClerkId(req);
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).clerkId = clerkId;
  next();
}

// ---------------------------------------------------------------------------
// Detect country from request headers (no external package needed)
// ---------------------------------------------------------------------------
function detectCountry(req: Request): string | null {
  const cf = req.headers["cf-ipcountry"] as string | undefined;
  if (cf && cf.length === 2 && !["XX", "T1"].includes(cf)) return cf.toUpperCase();
  const lang = req.headers["accept-language"] as string | undefined;
  if (lang) {
    const match = lang.match(/[a-z]{2}-([A-Z]{2})/i);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

// ---------------------------------------------------------------------------
// GET /api/users/me — return current user's DB profile (null → not set up yet)
// ---------------------------------------------------------------------------
router.get("/users/me", requireAuthMiddleware, async (req: Request, res: Response) => {
  const me = await getMe((req as any).clerkId);
  if (!me) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(me);
});

// ---------------------------------------------------------------------------
// POST /api/users/me — create / upsert profile (called after first sign-in)
// ---------------------------------------------------------------------------
router.post("/users/me", requireAuthMiddleware, async (req: Request, res: Response) => {
  const clerkId = (req as any).clerkId as string;
  const { username, displayName, avatarUrl } = req.body as {
    username: string;
    displayName: string;
    avatarUrl?: string;
  };

  if (!username || !displayName) {
    res.status(400).json({ error: "username and displayName are required" });
    return;
  }

  // Sanitise username: lowercase alphanumeric + underscores only
  const safeUsername = username
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 32);

  if (!safeUsername) {
    res.status(400).json({ error: "Invalid username" });
    return;
  }

  req.log.info({ clerkId, requestedUsername: username, safeUsername }, "profile upsert — received");

  try {
    const country = detectCountry(req);
    const [user] = await db
      .insert(usersTable)
      .values({
        clerkId,
        username: safeUsername,
        displayName: displayName.slice(0, 128),
        avatarUrl: avatarUrl ?? null,
        country,
      })
      .onConflictDoUpdate({
        target: usersTable.clerkId,
        set: {
          username: safeUsername,
          displayName: displayName.slice(0, 128),
          avatarUrl: avatarUrl ?? null,
          country,
        },
      })
      .returning();

    req.log.info({ storedUsername: user.username, storedDisplayName: user.displayName, userId: user.id }, "profile upsert — stored");

    // ── Backfill: associate any sessions created with this clerkId but no userId ──
    // This handles sessions created before the profile existed.
    const backfilled = await db
      .update(sessionsTable)
      .set({ userId: user.id })
      .where(
        and(
          eq(sessionsTable.clerkId, clerkId),
          isNull(sessionsTable.userId),
        ),
      )
      .returning({ id: sessionsTable.id });

    if (backfilled.length > 0) {
      req.log.info({ userId: user.id, count: backfilled.length }, "profile upsert — backfilled sessions");
    }

    // ── Sync lifetime reps and milestone badges from all associated sessions ──
    const allSessions = await db
      .select({
        exerciseName: exercisesTable.name,
        totalReps: sessionsTable.totalReps,
        completedAt: sessionsTable.completedAt,
      })
      .from(sessionsTable)
      .innerJoin(exercisesTable, eq(sessionsTable.exerciseId, exercisesTable.id))
      .where(eq(sessionsTable.userId, user.id));

    const lifetimeReps = computeLifetimeRepsFromSessions(allSessions);
    const earnedBadgeIds = computeEarnedBadgeIds(lifetimeReps);
    const exerciseStats = computeExerciseStatsFromSessions(allSessions);

    const [updatedUser] = await db
      .update(usersTable)
      .set({
        lifetimeRepsPush: lifetimeReps.push,
        lifetimeRepsPull: lifetimeReps.pull,
        lifetimeRepsCore: lifetimeReps.core,
        lifetimeRepsLegs: lifetimeReps.legs,
        earnedMilestoneBadges: earnedBadgeIds,
        exerciseStats,
      })
      .where(eq(usersTable.id, user.id))
      .returning();

    res.json(updatedUser ?? user);
  } catch {
    // Unique violation on username
    req.log.warn({ clerkId, safeUsername }, "profile upsert — username conflict");
    res.status(409).json({ error: "Username already taken" });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/users/me/privacy — update privacy level and/or community posts visibility
// ---------------------------------------------------------------------------
router.put(
  "/users/me/privacy",
  requireAuthMiddleware,
  async (req: Request, res: Response) => {
    const clerkId = (req as any).clerkId as string;
    const { privacyLevel, communityPostsPublic, showVerifiedBadge } = req.body as {
      privacyLevel?: string;
      communityPostsPublic?: boolean;
      showVerifiedBadge?: boolean;
    };

    if (privacyLevel !== undefined && !["public", "friends", "private"].includes(privacyLevel)) {
      res.status(400).json({ error: "Invalid privacyLevel" });
      return;
    }

    const me = await getMe(clerkId);
    if (!me) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    // Verified badge requires Pro
    if (showVerifiedBadge && !me.isPro) {
      res.status(403).json({ error: "Pro subscription required to show verified badge" });
      return;
    }

    const updateSet: Record<string, unknown> = {};
    if (privacyLevel !== undefined) updateSet.privacyLevel = privacyLevel;
    if (communityPostsPublic !== undefined) updateSet.communityPostsPublic = communityPostsPublic;
    if (showVerifiedBadge !== undefined) updateSet.showVerifiedBadge = showVerifiedBadge;

    if (Object.keys(updateSet).length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set(updateSet as any)
      .where(eq(usersTable.id, me.id))
      .returning();

    res.json(updated);
  },
);

// ---------------------------------------------------------------------------
// PUT /api/users/me/subscription — activate Pro trial
// ---------------------------------------------------------------------------
router.put(
  "/users/me/subscription",
  requireAuthMiddleware,
  async (req: Request, res: Response) => {
    const clerkId = (req as any).clerkId as string;
    const me = await getMe(clerkId);
    if (!me) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    const [updated] = await db
      .update(usersTable)
      .set({ isPro: true })
      .where(eq(usersTable.id, me.id))
      .returning();
    res.json(updated);
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/users/me/subscription — cancel Pro (sets isPro=false only)
// hasClaimedSigningBonus is intentionally NOT reset — the one-time bonus is
// permanent. Re-subscribers will not receive a second free Aura Pack.
// ---------------------------------------------------------------------------
router.delete(
  "/users/me/subscription",
  requireAuthMiddleware,
  async (req: Request, res: Response) => {
    const clerkId = (req as any).clerkId as string;
    const me = await getMe(clerkId);
    if (!me) { res.status(404).json({ error: "Profile not found" }); return; }
    if (!me.isPro) { res.status(400).json({ error: "Not currently subscribed" }); return; }
    const [updated] = await db
      .update(usersTable)
      .set({ isPro: false })
      .where(eq(usersTable.id, me.id))
      .returning();
    res.json(updated);
  },
);

// ---------------------------------------------------------------------------
// PUT /api/users/me/active-aura — set active aura (packId + voiceId + skinId)
// ---------------------------------------------------------------------------
router.put(
  "/users/me/active-aura",
  requireAuthMiddleware,
  async (req: Request, res: Response) => {
    const clerkId = (req as any).clerkId as string;
    const me = await getMe(clerkId);
    if (!me) { res.status(404).json({ error: "Profile not found" }); return; }

    const { packId, voiceId, skinId } = req.body as {
      packId?: string;
      voiceId?: string;
      skinId?: string;
    };

    const inventory = (me.inventory ?? ["classic"]) as string[];
    if (packId && !inventory.includes(packId)) {
      res.status(403).json({ error: "Pack not in inventory" });
      return;
    }

    const aura = { ...(me.activeAura as object), ...(packId && { packId }), ...(voiceId && { voiceId }), ...(skinId && { skinId }) };
    const [updated] = await db.update(usersTable).set({ activeAura: aura }).where(eq(usersTable.id, me.id)).returning();
    res.json(updated);
  },
);

// ---------------------------------------------------------------------------
// POST /api/shop/purchase — buy an Aura Pack by ID
// ---------------------------------------------------------------------------
router.post(
  "/shop/purchase",
  requireAuthMiddleware,
  async (req: Request, res: Response) => {
    const clerkId = (req as any).clerkId as string;
    const me = await getMe(clerkId);
    if (!me) { res.status(404).json({ error: "Profile not found" }); return; }

    const { packId } = req.body as { packId: string };
    if (!packId) { res.status(400).json({ error: "packId is required" }); return; }

    const inventory = (me.inventory ?? ["classic"]) as string[];
    if (inventory.includes(packId)) {
      res.json({ inventory, message: "Already owned" });
      return;
    }

    const newInventory = [...inventory, packId];
    const [updated] = await db
      .update(usersTable)
      .set({ inventory: newInventory })
      .where(eq(usersTable.id, me.id))
      .returning();
    res.json({ inventory: updated.inventory, message: "Purchase successful" });
  },
);

// ---------------------------------------------------------------------------
// POST /api/shop/claim-free-aura — claim signing bonus (Pro users only)
// ---------------------------------------------------------------------------
router.post(
  "/shop/claim-free-aura",
  requireAuthMiddleware,
  async (req: Request, res: Response) => {
    const clerkId = (req as any).clerkId as string;
    const me = await getMe(clerkId);
    if (!me) { res.status(404).json({ error: "Profile not found" }); return; }
    if (!me.isPro) { res.status(403).json({ error: "Pro subscription required" }); return; }
    if (me.hasClaimedSigningBonus) { res.status(409).json({ error: "Signing bonus already claimed" }); return; }

    const { packId } = req.body as { packId: string };
    if (!packId) { res.status(400).json({ error: "packId is required" }); return; }

    const inventory = (me.inventory ?? ["classic"]) as string[];
    const newInventory = inventory.includes(packId) ? inventory : [...inventory, packId];

    const [updated] = await db
      .update(usersTable)
      .set({ inventory: newInventory, hasClaimedSigningBonus: true })
      .where(eq(usersTable.id, me.id))
      .returning();
    res.json({ inventory: updated.inventory, message: "Signing bonus claimed!" });
  },
);

// ---------------------------------------------------------------------------
// POST /api/shop/redeem — redeem a promo code
// ---------------------------------------------------------------------------
const PROMO_CODES: Record<string, { type: "pro_month" | "pack"; packId?: string }> = {
  TESTER2026:  { type: "pro_month" },
  GHOSTGIFT:   { type: "pack", packId: "iron-circuit" },
  ZENGIFT:     { type: "pack", packId: "zen-garden" },
  HYPEGIFT:    { type: "pack", packId: "hype-storm" },
};

router.post(
  "/shop/redeem",
  requireAuthMiddleware,
  async (req: Request, res: Response) => {
    const clerkId = (req as any).clerkId as string;
    const me = await getMe(clerkId);
    if (!me) { res.status(404).json({ error: "Profile not found" }); return; }

    const rawCode = (req.body as { code?: string }).code ?? "";
    const code = rawCode.trim().toUpperCase();
    const promo = PROMO_CODES[code];
    if (!promo) { res.status(400).json({ error: "Invalid or unknown code" }); return; }

    const redeemed = (me.redeemedCodes ?? []) as string[];
    if (redeemed.includes(code)) {
      res.status(409).json({ error: "Code already redeemed" });
      return;
    }

    const newRedeemed = [...redeemed, code];
    const updateSet: Record<string, unknown> = { redeemedCodes: newRedeemed };

    if (promo.type === "pro_month") {
      updateSet.isPro = true;
    } else if (promo.type === "pack" && promo.packId) {
      const inventory = (me.inventory ?? ["classic"]) as string[];
      if (!inventory.includes(promo.packId)) {
        updateSet.inventory = [...inventory, promo.packId];
      }
    }

    const [updated] = await db
      .update(usersTable)
      .set(updateSet as any)
      .where(eq(usersTable.id, me.id))
      .returning();

    const message =
      promo.type === "pro_month"
        ? "1 free month of Pro activated!"
        : `Pack "${promo.packId}" added to your inventory!`;

    res.json({ user: updated, message });
  },
);

// ---------------------------------------------------------------------------
// PUT /api/users/me — update username / displayName
// ---------------------------------------------------------------------------
router.put(
  "/users/me",
  requireAuthMiddleware,
  async (req: Request, res: Response) => {
    const clerkId = (req as any).clerkId as string;
    const { username, displayName } = req.body as {
      username?: string;
      displayName?: string;
    };

    const me = await getMe(clerkId);
    if (!me) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const updateFields: Partial<typeof usersTable.$inferSelect> = {};
    if (displayName) updateFields.displayName = displayName.slice(0, 128);
    if (username) {
      const safeUsername = username
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "")
        .slice(0, 32);
      if (!safeUsername) {
        res.status(400).json({ error: "Invalid username" });
        return;
      }
      updateFields.username = safeUsername;
    }

    try {
      const [updated] = await db
        .update(usersTable)
        .set(updateFields)
        .where(eq(usersTable.id, me.id))
        .returning();
      res.json(updated);
    } catch {
      res.status(409).json({ error: "Username already taken" });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/users/search?q= — search by username or display name
// ---------------------------------------------------------------------------
router.get(
  "/users/search",
  requireAuthMiddleware,
  async (req: Request, res: Response) => {
    const q = ((req.query.q as string) || "").trim();
    if (q.length < 2) {
      res.json([]);
      return;
    }

    const clerkId = (req as any).clerkId as string;
    const me = await getMe(clerkId);

    const results = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        displayName: usersTable.displayName,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(usersTable)
      .where(
        or(
          ilike(usersTable.username, `%${q}%`),
          ilike(usersTable.displayName, `%${q}%`),
        ),
      )
      .limit(20);

    // Return all matches including self so users can find their own profile
    res.json(results);
  },
);

// ---------------------------------------------------------------------------
// GET /api/users/:username — public profile (skill tree + form mastery)
// ---------------------------------------------------------------------------
router.get(
  "/users/:username",
  requireAuthMiddleware,
  async (req: Request, res: Response) => {
    const { username } = req.params;
    const clerkId = (req as any).clerkId as string;

    const me = await getMe(clerkId);
    if (!me) {
      res.status(403).json({ error: "Complete your profile first" });
      return;
    }

    const [targetUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, String(username)));

    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Same user = always allowed
    const isSelf = targetUser.id === me.id;

    // Privacy check
    let canView = isSelf || targetUser.privacyLevel === "public";

    if (!canView && targetUser.privacyLevel === "friends") {
      const [friendship] = await db
        .select()
        .from(friendRequestsTable)
        .where(
          and(
            eq(friendRequestsTable.status, "accepted"),
            or(
              and(
                eq(friendRequestsTable.fromUserId, me.id),
                eq(friendRequestsTable.toUserId, targetUser.id),
              ),
              and(
                eq(friendRequestsTable.fromUserId, targetUser.id),
                eq(friendRequestsTable.toUserId, me.id),
              ),
            ),
          ),
        );
      canView = !!friendship;
    }

    // Also check if there's a pending/accepted request between them
    const [existingRequest] = await db
      .select()
      .from(friendRequestsTable)
      .where(
        or(
          and(
            eq(friendRequestsTable.fromUserId, me.id),
            eq(friendRequestsTable.toUserId, targetUser.id),
          ),
          and(
            eq(friendRequestsTable.fromUserId, targetUser.id),
            eq(friendRequestsTable.toUserId, me.id),
          ),
        ),
      );

    const userInfo = {
      id: targetUser.id,
      username: targetUser.username,
      displayName: targetUser.displayName,
      avatarUrl: targetUser.avatarUrl,
      privacyLevel: targetUser.privacyLevel,
    };

    if (!canView) {
      res.json({
        user: userInfo,
        hidden: true,
        friendRequestStatus: existingRequest?.status ?? null,
        friendRequestId: existingRequest?.id ?? null,
        friendRequestFromMe: existingRequest?.fromUserId === me.id,
        sessions: null,
        formMastery: null,
        totalSessions: 0,
        totalReps: 0,
        lifetimeReps: { push: 0, pull: 0, core: 0, legs: 0 },
        earnedMilestoneBadges: [],
        exerciseStats: {},
      });
      return;
    }

    // For own profile: also pick up sessions by clerkId where userId is still null,
    // and fully-unclaimed sessions (migration fallback for pre-clerkId sessions)
    const sessionWhere = isSelf
      ? or(
          eq(sessionsTable.userId, targetUser.id),
          and(isNull(sessionsTable.userId), eq(sessionsTable.clerkId, targetUser.clerkId)),
          and(isNull(sessionsTable.userId), isNull(sessionsTable.clerkId)),
        )!
      : eq(sessionsTable.userId, targetUser.id);

    const sessions = await db
      .select({
        exerciseName: exercisesTable.name,
        totalReps: sessionsTable.totalReps,
        avgFormScore: sessionsTable.avgFormScore,
        completedAt: sessionsTable.completedAt,
      })
      .from(sessionsTable)
      .innerJoin(exercisesTable, eq(sessionsTable.exerciseId, exercisesTable.id))
      .where(sessionWhere)
      .orderBy(desc(sessionsTable.startedAt));

    const completedSessions = sessions.filter(
      (s) => s.completedAt && s.avgFormScore != null,
    );
    const formMastery =
      completedSessions.length > 0
        ? Math.round(
            completedSessions.reduce((sum, s) => sum + (s.avgFormScore ?? 0), 0) /
              completedSessions.length,
          )
        : null;

    res.json({
      user: userInfo,
      hidden: false,
      friendRequestStatus: existingRequest?.status ?? null,
      friendRequestId: existingRequest?.id ?? null,
      friendRequestFromMe: existingRequest?.fromUserId === me.id,
      sessions,
      formMastery,
      totalSessions: completedSessions.length,
      totalReps: sessions.reduce((sum, s) => sum + (s.totalReps ?? 0), 0),
      lifetimeReps: {
        push: targetUser.lifetimeRepsPush,
        pull: targetUser.lifetimeRepsPull,
        core: targetUser.lifetimeRepsCore,
        legs: targetUser.lifetimeRepsLegs,
      },
      earnedMilestoneBadges: (targetUser.earnedMilestoneBadges as string[]) ?? [],
      exerciseStats: (targetUser.exerciseStats as ExerciseStatsMap) ?? {},
    });
  },
);

// ---------------------------------------------------------------------------
// GET /api/friends — list accepted friends with masteredSkillsCount for badges
// ---------------------------------------------------------------------------
router.get("/friends", requireAuthMiddleware, async (req: Request, res: Response) => {
  const clerkId = (req as any).clerkId as string;
  const me = await getMe(clerkId);
  if (!me) {
    res.json([]);
    return;
  }

  const rows = await db
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

  const friendIds = rows.map((r) =>
    r.fromUserId === me.id ? r.toUserId : r.fromUserId,
  );

  if (friendIds.length === 0) {
    res.json([]);
    return;
  }

  const friends = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(usersTable)
    .where(inArray(usersTable.id, friendIds));

  // Compute mastered skill count per friend for badge display
  const friendSessions = await db
    .select({
      userId: sessionsTable.userId,
      exerciseName: exercisesTable.name,
      totalReps: sessionsTable.totalReps,
      avgFormScore: sessionsTable.avgFormScore,
      completedAt: sessionsTable.completedAt,
      isVerified: sessionsTable.isVerified,
    })
    .from(sessionsTable)
    .innerJoin(exercisesTable, eq(sessionsTable.exerciseId, exercisesTable.id))
    .where(and(isNotNull(sessionsTable.userId), inArray(sessionsTable.userId, friendIds)));

  const sessionsByFriend = new Map<number, SessionRow[]>();
  for (const s of friendSessions) {
    if (s.userId == null) continue;
    const bucket = sessionsByFriend.get(s.userId) ?? [];
    bucket.push(s);
    sessionsByFriend.set(s.userId, bucket);
  }

  const result = friends.map((f) => {
    const sessions = sessionsByFriend.get(f.id) ?? [];
    const { masteredCount } = computeMasteryPoints(sessions);
    return { ...f, masteredSkillsCount: masteredCount };
  });

  res.json(result);
});

// ---------------------------------------------------------------------------
// GET /api/friends/requests — incoming + outgoing pending requests
// ---------------------------------------------------------------------------
router.get(
  "/friends/requests",
  requireAuthMiddleware,
  async (req: Request, res: Response) => {
    const clerkId = (req as any).clerkId as string;
    const me = await getMe(clerkId);
    if (!me) {
      res.json({ incoming: [], outgoing: [] });
      return;
    }

    const allRequests = await db
      .select({
        id: friendRequestsTable.id,
        fromUserId: friendRequestsTable.fromUserId,
        toUserId: friendRequestsTable.toUserId,
        status: friendRequestsTable.status,
        createdAt: friendRequestsTable.createdAt,
      })
      .from(friendRequestsTable)
      .where(
        and(
          eq(friendRequestsTable.status, "pending"),
          or(
            eq(friendRequestsTable.fromUserId, me.id),
            eq(friendRequestsTable.toUserId, me.id),
          ),
        ),
      );

    const incoming = allRequests.filter((r) => r.toUserId === me.id);
    const outgoing = allRequests.filter((r) => r.fromUserId === me.id);

    const relevantIds = [
      ...incoming.map((r) => r.fromUserId),
      ...outgoing.map((r) => r.toUserId),
    ];

    let userMap: Map<
      number,
      { id: number; username: string; displayName: string; avatarUrl: string | null }
    > = new Map();

    if (relevantIds.length > 0) {
      const users = await db
        .select({
          id: usersTable.id,
          username: usersTable.username,
          displayName: usersTable.displayName,
          avatarUrl: usersTable.avatarUrl,
        })
        .from(usersTable)
        .where(inArray(usersTable.id, relevantIds));
      userMap = new Map(users.map((u) => [u.id, u]));
    }

    res.json({
      incoming: incoming.map((r) => ({
        ...r,
        user: userMap.get(r.fromUserId),
      })),
      outgoing: outgoing.map((r) => ({
        ...r,
        user: userMap.get(r.toUserId),
      })),
    });
  },
);

// ---------------------------------------------------------------------------
// POST /api/friends/requests — send a friend request
// ---------------------------------------------------------------------------
router.post(
  "/friends/requests",
  requireAuthMiddleware,
  async (req: Request, res: Response) => {
    const clerkId = (req as any).clerkId as string;
    const me = await getMe(clerkId);
    if (!me) {
      res.status(403).json({ error: "Complete your profile first" });
      return;
    }

    const { username } = req.body as { username: string };
    if (!username) {
      res.status(400).json({ error: "username is required" });
      return;
    }

    const [targetUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, String(username)));

    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (targetUser.id === me.id) {
      res.status(400).json({ error: "Cannot add yourself" });
      return;
    }

    // Check for existing request in either direction
    const [existing] = await db
      .select()
      .from(friendRequestsTable)
      .where(
        or(
          and(
            eq(friendRequestsTable.fromUserId, me.id),
            eq(friendRequestsTable.toUserId, targetUser.id),
          ),
          and(
            eq(friendRequestsTable.fromUserId, targetUser.id),
            eq(friendRequestsTable.toUserId, me.id),
          ),
        ),
      );

    if (existing) {
      if (existing.status === "accepted") {
        res.status(409).json({ error: "Already friends" });
      } else if (existing.status === "pending") {
        res.status(409).json({ error: "Request already pending" });
      } else {
        // Rejected — allow re-sending by resetting
        const [updated] = await db
          .update(friendRequestsTable)
          .set({ status: "pending", fromUserId: me.id, toUserId: targetUser.id })
          .where(eq(friendRequestsTable.id, existing.id))
          .returning();
        res.status(201).json(updated);
      }
      return;
    }

    const [request] = await db
      .insert(friendRequestsTable)
      .values({ fromUserId: me.id, toUserId: targetUser.id })
      .returning();

    res.status(201).json(request);
  },
);

// ---------------------------------------------------------------------------
// PUT /api/friends/requests/:id — accept or reject
// ---------------------------------------------------------------------------
router.put(
  "/friends/requests/:id",
  requireAuthMiddleware,
  async (req: Request, res: Response) => {
    const clerkId = (req as any).clerkId as string;
    const me = await getMe(clerkId);
    if (!me) {
      res.status(403).json({ error: "Complete your profile first" });
      return;
    }

    const id = Number(req.params.id);
    const { action } = req.body as { action: "accept" | "reject" };

    if (!["accept", "reject"].includes(action)) {
      res.status(400).json({ error: "action must be accept or reject" });
      return;
    }

    const [request] = await db
      .select()
      .from(friendRequestsTable)
      .where(eq(friendRequestsTable.id, id));

    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    if (request.toUserId !== me.id) {
      res.status(403).json({ error: "Not your request to respond to" });
      return;
    }

    const [updated] = await db
      .update(friendRequestsTable)
      .set({
        status: action === "accept" ? "accepted" : "rejected",
        updatedAt: new Date(),
      })
      .where(eq(friendRequestsTable.id, id))
      .returning();

    res.json(updated);
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/friends/:friendId — remove a friend
// ---------------------------------------------------------------------------
router.delete(
  "/friends/:friendId",
  requireAuthMiddleware,
  async (req: Request, res: Response) => {
    const clerkId = (req as any).clerkId as string;
    const me = await getMe(clerkId);
    if (!me) {
      res.status(403).json({ error: "Profile not found" });
      return;
    }

    const friendId = Number(req.params.friendId);

    await db
      .delete(friendRequestsTable)
      .where(
        and(
          eq(friendRequestsTable.status, "accepted"),
          or(
            and(
              eq(friendRequestsTable.fromUserId, me.id),
              eq(friendRequestsTable.toUserId, friendId),
            ),
            and(
              eq(friendRequestsTable.fromUserId, friendId),
              eq(friendRequestsTable.toUserId, me.id),
            ),
          ),
        ),
      );

    res.json({ success: true });
  },
);

export default router;
