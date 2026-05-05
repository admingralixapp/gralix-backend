import { Router, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  usersTable,
  feedPostsTable,
  feedPostLikesTable,
  feedPostCommentsTable,
} from "@workspace/db";
import {
  eq,
  and,
  desc,
  sql,
  ilike,
} from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const storage = new ObjectStorageService();

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

// ---------------------------------------------------------------------------
// GET /api/community-feed — paginated feed, optional ?exercise= filter
// ---------------------------------------------------------------------------
router.get("/community-feed", async (req: Request, res: Response) => {
  const clerkId = getClerkId(req);
  const myUserId = clerkId ? (await getMe(clerkId))?.id ?? null : null;

  const exercise = req.query.exercise as string | undefined;
  const limit = Math.min(Number(req.query.limit ?? 20), 50);
  const offset = Number(req.query.offset ?? 0);

  const posts = await db
    .select({
      id: feedPostsTable.id,
      exerciseName: feedPostsTable.exerciseName,
      caption: feedPostsTable.caption,
      videoObjectPath: feedPostsTable.videoObjectPath,
      isAiVerified: feedPostsTable.isAiVerified,
      sessionId: feedPostsTable.sessionId,
      likeCount: feedPostsTable.likeCount,
      createdAt: feedPostsTable.createdAt,
      userId: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(feedPostsTable)
    .innerJoin(usersTable, eq(feedPostsTable.userId, usersTable.id))
    .where(
      exercise && exercise !== "all"
        ? ilike(feedPostsTable.exerciseName, `%${exercise}%`)
        : undefined,
    )
    .orderBy(desc(feedPostsTable.createdAt))
    .limit(limit)
    .offset(offset);

  // Attach liked-by-me flag
  let likedPostIds = new Set<number>();
  if (myUserId) {
    const likes = await db
      .select({ postId: feedPostLikesTable.postId })
      .from(feedPostLikesTable)
      .where(eq(feedPostLikesTable.userId, myUserId));
    likedPostIds = new Set(likes.map((l) => l.postId));
  }

  const result = posts.map((p) => ({
    ...p,
    likedByMe: likedPostIds.has(p.id),
    videoUrl: p.videoObjectPath ? `/api/storage${p.videoObjectPath}` : null,
  }));

  res.json({ posts: result });
});

// ---------------------------------------------------------------------------
// POST /api/community-feed — create a post
// ---------------------------------------------------------------------------
router.post("/community-feed", async (req: Request, res: Response) => {
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

  const {
    exerciseName,
    caption,
    videoObjectPath,
    isAiVerified,
    sessionId,
  } = req.body as {
    exerciseName: string;
    caption?: string;
    videoObjectPath?: string;
    isAiVerified?: boolean;
    sessionId?: number;
  };

  if (!exerciseName) {
    res.status(400).json({ error: "exerciseName is required" });
    return;
  }

  const [post] = await db
    .insert(feedPostsTable)
    .values({
      userId: me.id,
      exerciseName,
      caption: caption ?? "",
      videoObjectPath: videoObjectPath ?? null,
      isAiVerified: isAiVerified ?? false,
      sessionId: sessionId ?? null,
    })
    .returning();

  res.status(201).json({
    ...post,
    videoUrl: post.videoObjectPath ? `/api/storage${post.videoObjectPath}` : null,
  });
});

// ---------------------------------------------------------------------------
// POST /api/community-feed/:id/like — toggle like
// ---------------------------------------------------------------------------
router.post("/community-feed/:id/like", async (req: Request, res: Response) => {
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

  const postId = Number(req.params.id);
  if (isNaN(postId)) {
    res.status(400).json({ error: "Invalid post id" });
    return;
  }

  // Check existing like
  const [existing] = await db
    .select()
    .from(feedPostLikesTable)
    .where(
      and(
        eq(feedPostLikesTable.postId, postId),
        eq(feedPostLikesTable.userId, me.id),
      ),
    );

  let liked: boolean;
  if (existing) {
    await db
      .delete(feedPostLikesTable)
      .where(
        and(
          eq(feedPostLikesTable.postId, postId),
          eq(feedPostLikesTable.userId, me.id),
        ),
      );
    await db
      .update(feedPostsTable)
      .set({ likeCount: sql`${feedPostsTable.likeCount} - 1` })
      .where(eq(feedPostsTable.id, postId));
    liked = false;
  } else {
    await db
      .insert(feedPostLikesTable)
      .values({ postId, userId: me.id })
      .onConflictDoNothing();
    await db
      .update(feedPostsTable)
      .set({ likeCount: sql`${feedPostsTable.likeCount} + 1` })
      .where(eq(feedPostsTable.id, postId));
    liked = true;
  }

  const [updated] = await db
    .select({ likeCount: feedPostsTable.likeCount })
    .from(feedPostsTable)
    .where(eq(feedPostsTable.id, postId));

  res.json({ liked, likeCount: updated?.likeCount ?? 0 });
});

// ---------------------------------------------------------------------------
// GET /api/community-feed/:id/comments
// ---------------------------------------------------------------------------
router.get("/community-feed/:id/comments", async (req: Request, res: Response) => {
  const postId = Number(req.params.id);
  if (isNaN(postId)) {
    res.status(400).json({ error: "Invalid post id" });
    return;
  }

  const comments = await db
    .select({
      id: feedPostCommentsTable.id,
      content: feedPostCommentsTable.content,
      createdAt: feedPostCommentsTable.createdAt,
      userId: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(feedPostCommentsTable)
    .innerJoin(usersTable, eq(feedPostCommentsTable.userId, usersTable.id))
    .where(eq(feedPostCommentsTable.postId, postId))
    .orderBy(desc(feedPostCommentsTable.createdAt))
    .limit(30);

  res.json({ comments });
});

// ---------------------------------------------------------------------------
// POST /api/community-feed/:id/comments
// ---------------------------------------------------------------------------
router.post("/community-feed/:id/comments", async (req: Request, res: Response) => {
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

  const postId = Number(req.params.id);
  if (isNaN(postId)) {
    res.status(400).json({ error: "Invalid post id" });
    return;
  }

  const { content } = req.body as { content: string };
  if (!content?.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const [comment] = await db
    .insert(feedPostCommentsTable)
    .values({ postId, userId: me.id, content: content.trim() })
    .returning({ id: feedPostCommentsTable.id, createdAt: feedPostCommentsTable.createdAt });

  res.status(201).json({
    id: comment.id,
    content: content.trim(),
    createdAt: comment.createdAt,
    userId: me.id,
    username: me.username,
    displayName: me.displayName,
    avatarUrl: me.avatarUrl,
  });
});

// ---------------------------------------------------------------------------
// POST /api/storage/uploads/request-url (re-exported here for convenience)
// This is also handled by the storage router — we keep community-feed self-contained
// ---------------------------------------------------------------------------

export default router;
