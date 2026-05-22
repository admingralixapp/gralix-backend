import { useEffect, useRef, useState } from "react";
import { useGetRecentSessions, getGetRecentSessionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Calendar,
  ChevronRight,
  Clock,
  Dumbbell,
  Layers,
  PenLine,
  Play,
  ShieldCheck,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { getClip } from "@/lib/clip-store";

// ─── Branch classification ────────────────────────────────────────────────────

type Branch = "PUSH" | "PULL" | "CORE" | "LEGS";

const BRANCH_STYLES: Record<Branch, { label: string; bg: string; text: string; border: string }> = {
  PUSH: { label: "Push", bg: "bg-transparent", text: "text-foreground", border: "border-black/25" },
  PULL: { label: "Pull", bg: "bg-transparent", text: "text-foreground", border: "border-black/25" },
  CORE: { label: "Core", bg: "bg-transparent", text: "text-foreground", border: "border-black/25" },
  LEGS: { label: "Legs", bg: "bg-transparent", text: "text-foreground", border: "border-black/25" },
};

function getExerciseBranch(name: string): Branch {
  const n = name.toLowerCase();
  if (["push", "dip", "planche", "handstand", "muscle-up", "chest", "tricep", "press", "pike", "pseudo", "archer", "diamond", "shoulder"].some(k => n.includes(k))) return "PUSH";
  if (["pull", "chin", "row", "hang", "lever", "lat", "bicep", "curl", "inverted", "face", "typewriter", "towel"].some(k => n.includes(k))) return "PULL";
  if (["squat", "lunge", "pistol", "nordic", "jump", "calf", "leg", "glute", "deadlift", "hip thrust", "step-up", "wall sit"].some(k => n.includes(k))) return "LEGS";
  return "CORE";
}

// ─── Video modal ──────────────────────────────────────────────────────────────

function VideoModal({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
        >
          <X className="w-4 h-4 text-white" />
        </button>
        <video
          src={url}
          controls
          autoPlay
          className="w-full aspect-video bg-black"
        />
      </div>
    </div>
  );
}

// ─── Session card ─────────────────────────────────────────────────────────────

interface SessionCardProps {
  session: {
    id: number;
    exerciseName: string;
    startedAt: string;
    totalReps: number;
    avgFormScore: number | null;
    durationMinutes: number | null;
    logType: string;
    isVerified: boolean;
  };
}

function SessionCard({ session }: SessionCardProps) {
  const { t } = useTranslation();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const clip = getClip(session.id);
  const hasClip = clip !== null;
  const clipSrc = clip
    ? clip.objectPath.startsWith("http")
      ? clip.objectPath
      : `/api/storage${clip.objectPath}`
    : null;
  const branch = getExerciseBranch(session.exerciseName);
  const bs = BRANCH_STYLES[branch];

  const formScore = session.avgFormScore != null ? Math.round(session.avgFormScore) : null;
  const dur = session.durationMinutes != null ? Math.round(session.durationMinutes) : null;

  const scoreColor =
    formScore == null ? "text-muted-foreground"
    : formScore >= 85  ? "text-primary"
    : formScore >= 65  ? "text-amber-400"
    : "text-rose-400";

  return (
    <>
      <Card className="group hover:bg-white/[0.04] transition-all cursor-pointer border-border/60">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            {/* ── Left column ── */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Exercise name + badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Link href={`/session/${session.id}`}>
                  <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors truncate max-w-[200px] sm:max-w-none">
                    {session.exerciseName}
                  </h3>
                </Link>

                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${bs.bg} ${bs.text} ${bs.border}`}>
                  {bs.label}
                </span>

                {session.isVerified ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                    style={{ color: "#177548", borderColor: "#177548", background: "rgba(23,117,72,0.07)" }}>
                    <ShieldCheck className="w-2.5 h-2.5" />
                    {t("history.aiVerified", "Form Verified")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted/60 border border-border text-muted-foreground">
                    <PenLine className="w-2.5 h-2.5" />
                    {session.logType === "manual"
                      ? t("history.manual", "Manual")
                      : t("history.selfReported", "Unverified")}
                  </span>
                )}
              </div>

              {/* Date + duration */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  {format(new Date(session.startedAt), "MMM d, yyyy · h:mm a")}
                </span>
                {dur != null && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    {dur}m
                  </span>
                )}
              </div>
            </div>

            {/* ── Right column: stats ── */}
            <div className="flex items-center gap-4 sm:gap-6 shrink-0">
              {/* Reps */}
              <div className="text-right">
                <div className="font-mono text-2xl font-bold">{session.totalReps}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("history.reps", "Reps")}
                </div>
              </div>

              {/* Form score */}
              {formScore != null && (
                <div className="text-right hidden sm:block">
                  <div className={`font-mono text-2xl font-bold ${scoreColor}`}
                    style={undefined}>
                    {formScore}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("history.avgForm", "Avg Form")}
                  </div>
                </div>
              )}

              {/* Clip play button */}
              {hasClip && clip && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (clipSrc) setVideoUrl(clipSrc); }}
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all"
                  style={{
                    background: "rgba(34,197,94,0.12)",
                    border: "1px solid rgba(34,197,94,0.3)",
                    boxShadow: "0 0 10px rgba(34,197,94,0.15)",
                  }}
                  title="Play workout clip"
                >
                  <Play className="w-4 h-4 text-primary fill-primary" />
                </button>
              )}

              {/* Arrow — links to session detail */}
              <Link href={`/session/${session.id}`}>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {videoUrl && <VideoModal url={videoUrl} onClose={() => setVideoUrl(null)} />}
    </>
  );
}

// ─── History component ────────────────────────────────────────────────────────

// Limit high enough to return the full history for any realistic user.
const HISTORY_LIMIT = 500;

export function History() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Track whether the in-flight refetch on this mount has settled.
  const [ready, setReady] = useState(false);
  const mountId = useRef(0);

  // Use the exact same hook as the Dashboard's Recent Sessions widget,
  // just with a much higher limit so we get the full history.
  const { data: sessions, isLoading, isError } = useGetRecentSessions(
    { limit: HISTORY_LIMIT },
  );

  // Every time this component mounts (i.e. the user clicks the History tab),
  // fire an explicit refetch that bypasses the React Query cache entirely.
  useEffect(() => {
    const id = ++mountId.current;
    setReady(false);
    void queryClient
      .refetchQueries({ queryKey: getGetRecentSessionsQueryKey({ limit: HISTORY_LIMIT }) })
      .then(() => {
        if (mountId.current === id) setReady(true);
      });
  }, [queryClient]);

  // Sort descending by startedAt (server already does this, but enforce it
  // client-side too in case of cached data from a different limit).
  const sorted = sessions
    ? [...sessions].sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )
    : [];

  const showSkeleton = !ready || isLoading;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("history.title", "Workout History")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("history.subtitle", "Review your past performance.")}
            {!showSkeleton && sorted.length > 0 && (
              <span className="ml-2 font-semibold text-foreground/70">
                {sorted.length} session{sorted.length !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Loading state */}
      {showSkeleton ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>

      /* Error state */
      ) : isError ? (
        <div className="text-center py-20 border border-dashed border-red-500/30 rounded-2xl">
          <Dumbbell className="w-12 h-12 text-red-400/40 mx-auto mb-4" />
          <p className="font-semibold text-red-400 mb-1">
            Couldn't load your workouts
          </p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Something went wrong. Please try refreshing the page.
          </p>
        </div>

      /* Empty state */
      ) : sorted.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
          <Dumbbell className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
          <p className="font-semibold text-foreground mb-1">
            No sessions found.
          </p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">
            Start a workout to see your history here!
          </p>
          <Button asChild>
            <Link href="/training">
              Start a Workout
            </Link>
          </Button>
        </div>

      /* Session list */
      ) : (
        <div className="grid gap-3">
          {sorted.map(session => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}

      {/* Clip policy note */}
      {!showSkeleton && sorted.some(s => getClip(s.id) !== null) && (
        <p className="text-[11px] text-muted-foreground text-center">
          {t("history.clipPolicy", "Workout clips are stored locally and expire after 7 days.")}
        </p>
      )}
    </div>
  );
}
