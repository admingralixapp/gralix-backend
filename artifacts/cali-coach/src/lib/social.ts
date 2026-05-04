import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Shared fetch helper — always includes cookies for Clerk session auth
// ---------------------------------------------------------------------------
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error ?? "Request failed");
  }
  return res.json() as Promise<T>;
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
}

// ---------------------------------------------------------------------------
// My profile
// ---------------------------------------------------------------------------
export function useMyProfile() {
  return useQuery<UserProfile | null>({
    queryKey: ["/api/users/me"],
    queryFn: () =>
      apiFetch<UserProfile>("/api/users/me").catch(() => null),
    retry: false,
    staleTime: 60_000,
  });
}

export function useUpsertProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { username: string; displayName: string; avatarUrl?: string }) =>
      apiFetch<UserProfile>("/api/users/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/users/me"] }),
  });
}

export function useUpdatePrivacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (privacyLevel: "public" | "friends" | "private") =>
      apiFetch<UserProfile>("/api/users/me/privacy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privacyLevel }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/users/me"] }),
  });
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
export function useSearchUsers(q: string) {
  return useQuery<Pick<UserProfile, "id" | "username" | "displayName" | "avatarUrl">[]>({
    queryKey: ["/api/users/search", q],
    queryFn: () =>
      apiFetch(`/api/users/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
  });
}

// ---------------------------------------------------------------------------
// Friend's public profile
// ---------------------------------------------------------------------------
export function useFriendProfile(username: string) {
  return useQuery<PublicProfile>({
    queryKey: ["/api/users", username],
    queryFn: () => apiFetch(`/api/users/${encodeURIComponent(username)}`),
    enabled: !!username,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Friends list
// ---------------------------------------------------------------------------
export function useFriends() {
  return useQuery<Pick<UserProfile, "id" | "username" | "displayName" | "avatarUrl">[]>({
    queryKey: ["/api/friends"],
    queryFn: () => apiFetch<Pick<UserProfile, "id" | "username" | "displayName" | "avatarUrl">[]>("/api/friends").catch(() => []),
    staleTime: 30_000,
    retry: false,
  });
}

// ---------------------------------------------------------------------------
// Friend requests
// ---------------------------------------------------------------------------
export function useFriendRequests() {
  return useQuery<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>({
    queryKey: ["/api/friends/requests"],
    queryFn: () =>
      apiFetch<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>("/api/friends/requests").catch(
        () => ({ incoming: [], outgoing: [] }),
      ),
    staleTime: 15_000,
    retry: false,
  });
}

export function useSendFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (username: string) =>
      apiFetch<FriendRequest>("/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/friends/requests"] });
      qc.invalidateQueries({ queryKey: ["/api/friends"] });
    },
  });
}

export function useRespondToRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: "accept" | "reject" }) =>
      apiFetch<FriendRequest>(`/api/friends/requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }),
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
  return useQuery<LeaderboardData>({
    queryKey: ["/api/leaderboard", tab],
    queryFn: () =>
      apiFetch<LeaderboardData>(`/api/leaderboard/${tab}`).catch(() => ({
        entries: [],
        myRank: null,
        myPoints: 0,
        myMasteredSkills: 0,
        country: null,
      })),
    staleTime: 60_000,
    retry: false,
  });
}

export function useRemoveFriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (friendId: number) =>
      apiFetch(`/api/friends/${friendId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/friends"] });
      qc.invalidateQueries({ queryKey: ["/api/friends/requests"] });
    },
  });
}
