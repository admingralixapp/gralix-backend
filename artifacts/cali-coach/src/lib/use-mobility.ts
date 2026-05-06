import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { useEffect } from "react";
import { GOAL_LABELS, type MobilityGoal } from "./mobility-service";

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
export interface MobilitySettings {
  enabled: boolean;
  /** "HH:MM" */
  notificationTime: string;
  mobilityGoal: string;
  /** Comma-separated stiffness areas e.g. "Wrists,Hips" */
  stiffnessAreas: string;
  /** 5 | 10 | 15 */
  dailyTimeMinutes: number;
}

export interface MobilityStatus {
  completedToday: boolean;
  currentStreak: number;
  settings: MobilitySettings;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
export function useMobilityStatus() {
  const { getToken } = useAuth();
  return useQuery<MobilityStatus | null>({
    queryKey: ["/api/mobility/status"],
    queryFn: async () => {
      const token = await getToken();
      return apiFetchAuth<MobilityStatus>("/api/mobility/status", token).catch(() => null);
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useCompleteMobility() {
  const qc = useQueryClient();
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async ({ goal }: { goal?: string }) => {
      const token = await getToken();
      return apiFetchAuth<{ completedToday: boolean; currentStreak: number }>(
        "/api/mobility/complete",
        token,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal }),
        },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/mobility/status"] });
    },
  });
}

export function useUpdateMobilitySettings() {
  const qc = useQueryClient();
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (settings: Partial<MobilitySettings>) => {
      const token = await getToken();
      return apiFetchAuth<MobilitySettings>("/api/mobility/settings", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/mobility/status"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Browser notification helpers
// ---------------------------------------------------------------------------
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function scheduleNextNotification(
  timeHHMM: string,
  goalLabel: string,
  stiffnessAreas: string,
  dailyTimeMinutes: number,
): void {
  const win = window as WinWithTimer;
  if (typeof win.__mobilityNotifTimeout === "number") {
    clearTimeout(win.__mobilityNotifTimeout);
  }

  const [h, m] = timeHHMM.split(":").map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const msUntil = next.getTime() - now.getTime();

  // Build a goal-specific, personalised notification body
  const areas = stiffnessAreas
    ? stiffnessAreas.split(",").filter(Boolean).slice(0, 2).join(" & ")
    : "";
  const focusLine = areas ? ` Focus: ${areas}.` : "";
  const body = `Ready to work toward your ${goalLabel}? Your ${dailyTimeMinutes}-min mobility prep is waiting.${focusLine}`;

  win.__mobilityNotifTimeout = window.setTimeout(() => {
    if (Notification.permission === "granted") {
      new Notification("CaliCoach — Daily Tasks", {
        body,
        icon: "/logo.svg",
        tag: "calicoach-mobility",
      });
    }
    scheduleNextNotification(timeHHMM, goalLabel, stiffnessAreas, dailyTimeMinutes);
  }, msUntil);
}

type WinWithTimer = Window & { __mobilityNotifTimeout?: number };

export function useNotificationScheduler(
  status: MobilityStatus | null | undefined,
): void {
  useEffect(() => {
    if (!status?.settings.enabled) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const goal = status.settings.mobilityGoal as MobilityGoal;
    const goalLabel = GOAL_LABELS[goal] ?? goal;
    scheduleNextNotification(
      status.settings.notificationTime,
      goalLabel,
      status.settings.stiffnessAreas ?? "",
      status.settings.dailyTimeMinutes ?? 10,
    );

    return () => {
      const win = window as WinWithTimer;
      if (typeof win.__mobilityNotifTimeout === "number") {
        clearTimeout(win.__mobilityNotifTimeout);
      }
    };
  }, [
    status?.settings.enabled,
    status?.settings.notificationTime,
    status?.settings.mobilityGoal,
    status?.settings.stiffnessAreas,
    status?.settings.dailyTimeMinutes,
  ]);
}
