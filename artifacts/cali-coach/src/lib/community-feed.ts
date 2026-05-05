import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeedPost {
  id: number;
  exerciseName: string;
  caption: string;
  videoObjectPath: string | null;
  videoUrl: string | null;
  isAiVerified: boolean;
  sessionId: number | null;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface FeedComment {
  id: number;
  content: string;
  createdAt: string;
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error((body as { error?: string }).error ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Upload a blob to object storage via presigned URL
// Returns the objectPath (e.g. "/objects/uploads/xxx")
// ---------------------------------------------------------------------------

export async function uploadVideoBlob(blob: Blob, exerciseName: string): Promise<string> {
  const filename = `calicoach-${exerciseName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.webm`;

  const { uploadURL, objectPath } = await apiFetch<{ uploadURL: string; objectPath: string }>(
    "/api/storage/uploads/request-url",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: filename, size: blob.size, contentType: blob.type || "video/webm" }),
    },
  );

  await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": blob.type || "video/webm" },
    body: blob,
  });

  return objectPath as string;
}

// ---------------------------------------------------------------------------
// React Query hooks
// ---------------------------------------------------------------------------

export function useCommunityFeed(exerciseFilter?: string) {
  return useQuery({
    queryKey: ["community-feed", exerciseFilter ?? "all"],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "30" });
      if (exerciseFilter && exerciseFilter !== "all") params.set("exercise", exerciseFilter);
      return apiFetch<{ posts: FeedPost[] }>(`/api/community-feed?${params}`).then((r) => r.posts);
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      exerciseName: string;
      caption?: string;
      videoObjectPath?: string;
      isAiVerified?: boolean;
      sessionId?: number;
    }) =>
      apiFetch<FeedPost>("/api/community-feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["community-feed"] });
    },
  });
}

export function useToggleLike(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ liked: boolean; likeCount: number }>(`/api/community-feed/${postId}/like`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["community-feed"] });
    },
  });
}

export function usePostComments(postId: number, enabled = true) {
  return useQuery({
    queryKey: ["feed-comments", postId],
    queryFn: () =>
      apiFetch<{ comments: FeedComment[] }>(`/api/community-feed/${postId}/comments`).then(
        (r) => r.comments,
      ),
    enabled,
    staleTime: 15_000,
  });
}

export function useAddComment(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      apiFetch<FeedComment>(`/api/community-feed/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feed-comments", postId] });
      void qc.invalidateQueries({ queryKey: ["community-feed"] });
    },
  });
}
