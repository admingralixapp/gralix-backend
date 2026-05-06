import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";

// ---------------------------------------------------------------------------
// Shared fetch helpers
// ---------------------------------------------------------------------------
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

// Merges a Bearer token into the request headers for authenticated mutations
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
// Types
// ---------------------------------------------------------------------------
export interface UserProfile {
  id: number;
  clerkId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  privacyLevel: "public" | "friends" | "private";
  communityPostsPublic: boolean;
  createdAt: string;
}

export interface FriendRequest {
  id: number;
  fromUserId: number;
  toUserId: number;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  user: Pick<UserProfile, "id" | "username" | "displayName" | "avatarUrl">;
}

export interface PublicProfile {
  user: Pick<UserProfile, "id" | "username" | "displayName" | "avatarUrl" | "privacyLevel">;
  hidden: boolean;
  sessions: Array<{
    exerciseName: string;
    totalReps: number;
    avgFormScore: number | null;
    completedAt: string | null;
  }> | null;
  formMastery: number | null;
  totalSessions: number;
  totalReps: number;
  lifetimeReps?: { push: number; pull: number; core: number; legs: number };
  earnedMilestoneBadges?: string[];
}

// ---------------------------------------------------------------------------
// My profile
// ---------------------------------------------------------------------------
export function useMyProfile() {
  const { getToken } = useAuth();
  return useQuery<UserProfile | null>({
    queryKey: ["/api/users/me"],
    queryFn: async () => {
      const token = await getToken();
      return apiFetchAuth<UserProfile>("/api/users/me", token).catch(() => null);
    },
    retry: false,
    staleTime: 60_000,
  });
}

export function useUpsertProfile() {
  const qc = useQueryClient();
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (data: { username: string; displayName: string; avatarUrl?: string }) => {
      const token = await getToken();
      return apiFetchAuth<UserProfile>("/api/users/me", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      // Invalidate own profile
      void qc.invalidateQueries({ queryKey: ["/api/users/me"] });
      // Bust leaderboard (all tabs) so the updated username appears immediately
      void qc.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      // Bust search cache so find-friends shows the new username right away
      void qc.invalidateQueries({ queryKey: ["/api/users/search"] });
      // Bust public profile pages (e.g. /profile/:username)
      void qc.invalidateQueries({ queryKey: ["/api/users"] });
      // Bust friends list in case display name changed
      void qc.invalidateQueries({ queryKey: ["/api/friends"] });
    },
  });
}

export function useUpdatePrivacy() {
  const qc = useQueryClient();
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (privacyLevel: "public" | "friends" | "private") => {
      const token = await getToken();
      return apiFetchAuth<UserProfile>("/api/users/me/privacy", token, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privacyLevel }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/users/me"] }),
  });
}

export function useUpdateCommunityPostsPublic() {
  const qc = useQueryClient();
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (communityPostsPublic: boolean) => {
      const token = await getToken();
      return apiFetchAuth<UserProfile>("/api/users/me/privacy", token, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communityPostsPublic }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/users/me"] }),
  });
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
export function useSearchUsers(q: string) {
  const { getToken } = useAuth();
  return useQuery<Pick<UserProfile, "id" | "username" | "displayName" | "avatarUrl">[]>({
    queryKey: ["/api/users/search", q],
    queryFn: async () => {
      const token = await getToken();
      return apiFetchAuth(`/api/users/search?q=${encodeURIComponent(q)}`, token);
    },
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
  });
}

// ---------------------------------------------------------------------------
// Friend's public profile
// ---------------------------------------------------------------------------
export function useFriendProfile(username: string) {
  const { getToken } = useAuth();
  return useQuery<PublicProfile>({
    queryKey: ["/api/users", username],
    queryFn: async () => {
      const token = await getToken();
      return apiFetchAuth(`/api/users/${encodeURIComponent(username)}`, token);
    },
    enabled: !!username,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Friends list
// ---------------------------------------------------------------------------
export interface FriendWithBadge extends Pick<UserProfile, "id" | "username" | "displayName" | "avatarUrl"> {
  masteredSkillsCount: number;
}

export function useFriends() {
  const { getToken } = useAuth();
  return useQuery<FriendWithBadge[]>({
    queryKey: ["/api/friends"],
    queryFn: async () => {
      const token = await getToken();
      return apiFetchAuth<FriendWithBadge[]>("/api/friends", token).catch(() => []);
    },
    staleTime: 30_000,
    retry: false,
  });
}

// ---------------------------------------------------------------------------
// Friend requests
// ---------------------------------------------------------------------------
export function useFriendRequests() {
  const { getToken } = useAuth();
  return useQuery<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>({
    queryKey: ["/api/friends/requests"],
    queryFn: async () => {
      const token = await getToken();
      return apiFetchAuth<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>("/api/friends/requests", token).catch(
        () => ({ incoming: [], outgoing: [] }),
      );
    },
    staleTime: 15_000,
    retry: false,
  });
}

export function useSendFriendRequest() {
  const qc = useQueryClient();
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (username: string) => {
      const token = await getToken();
      return apiFetchAuth<FriendRequest>("/api/friends/requests", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/friends/requests"] });
      qc.invalidateQueries({ queryKey: ["/api/friends"] });
    },
  });
}

export function useRespondToRequest() {
  const qc = useQueryClient();
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "accept" | "reject" }) => {
      const token = await getToken();
      return apiFetchAuth<FriendRequest>(`/api/friends/requests/${id}`, token, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/friends/requests"] });
      qc.invalidateQueries({ queryKey: ["/api/friends"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------
export interface LeaderboardEntry {
  rank: number;
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  country: string | null;
  masteryPoints: number;
  masteredSkills: number;
}

export interface LeaderboardData {
  entries: LeaderboardEntry[];
  myRank: number | null;
  myPoints: number;
  myMasteredSkills: number;
  country?: string | null;
}

export function useLeaderboard(tab: "global" | "national" | "friends") {
  const { getToken } = useAuth();
  return useQuery<LeaderboardData>({
    queryKey: ["/api/leaderboard", tab],
    queryFn: async () => {
      const token = await getToken();
      return apiFetchAuth<LeaderboardData>(`/api/leaderboard/${tab}`, token).catch(() => ({
        entries: [],
        myRank: null,
        myPoints: 0,
        myMasteredSkills: 0,
        country: null,
      }));
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useRemoveFriend() {
  const qc = useQueryClient();
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (friendId: number) => {
      const token = await getToken();
      return apiFetchAuth(`/api/friends/${friendId}`, token, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/friends"] });
      qc.invalidateQueries({ queryKey: ["/api/friends/requests"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Feed & Shoutouts
// ---------------------------------------------------------------------------
export interface FeedEntry {
  id: number;
  skillId: string;
  skillTitle: string;
  branch: string;
  createdAt: string;
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface MasteredSkillInfo {
  id: string;
  level: number;
  levelName: string;
  title: string;
  branch: string;
}

export function useFeed() {
  const { getToken } = useAuth();
  return useQuery<{ entries: FeedEntry[] }>({
    queryKey: ["/api/feed"],
    queryFn: async () => {
      const token = await getToken();
      return apiFetchAuth<{ entries: FeedEntry[] }>("/api/feed", token).catch(() => ({
        entries: [],
      }));
    },
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: true,
  });
}

export function useCreateShoutout() {
  const qc = useQueryClient();
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (data: { skillId: string; skillTitle: string; branch: string }) => {
      const token = await getToken();
      return apiFetchAuth("/api/shoutouts", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/feed"] }),
  });
}

export function useMasteredSkills(enabled: boolean) {
  const { getToken } = useAuth();
  return useQuery<{ mastered: MasteredSkillInfo[] }>({
    queryKey: ["/api/skills/mastered"],
    queryFn: async () => {
      const token = await getToken();
      return apiFetchAuth<{ mastered: MasteredSkillInfo[] }>("/api/skills/mastered", token).catch(
        () => ({ mastered: [] }),
      );
    },
    enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
