import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";

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

async function apiFetchAuth<T>(
  url: string,
  token: string | null,
  options?: RequestInit,
): Promise<T> {
  const extraHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};
  return apiFetch<T>(url, {
    ...options,
    headers: {
      ...(options?.headers as Record<string, string> | undefined),
      ...extraHeaders,
    },
  });
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
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (body: {
      exerciseName: string;
      caption?: string;
      videoObjectPath?: string;
      isAiVerified?: boolean;
      sessionId?: number;
    }) => {
      const token = await getToken();
      return apiFetchAuth<FeedPost>("/api/community-feed", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["community-feed"] });
    },
  });
}

export function useToggleLike(postId: number) {
  const qc = useQueryClient();
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return apiFetchAuth<{ liked: boolean; likeCount: number }>(`/api/community-feed/${postId}/like`, token, {
        method: "POST",
      });
    },
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
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (content: string) => {
      const token = await getToken();
      return apiFetchAuth<FeedComment>(`/api/community-feed/${postId}/comments`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feed-comments", postId] });
      void qc.invalidateQueries({ queryKey: ["community-feed"] });
    },
  });
}
