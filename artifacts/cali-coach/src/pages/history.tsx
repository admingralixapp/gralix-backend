import { useListSessions } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { Link } from "wouter";
import { Calendar, ChevronRight, PenLine, ShieldCheck, Video, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import { getClip } from "@/lib/clip-store";

// ─── Exercise → branch classification ────────────────────────────────────────
// Maps exercise names to workout category for the coloured branch pill.

type Branch = "PUSH" | "PULL" | "CORE" | "LEGS";

const PUSH_KEYWORDS = [
  "push", "dip", "planche", "handstand", "muscle-up", "chest", "tricep",
  "press", "pike", "pseudo", "archer", "diamond", "shoulder",
];
const PULL_KEYWORDS = [
  "pull", "chin", "row", "hang", "lever", "lat", "bicep", "curl",
  "inverted", "face", "typewriter", "towel",
];
const LEGS_KEYWORDS = [
  "squat", "lunge", "pistol", "nordic", "jump", "calf", "leg", "glute",
  "deadlift", "hip thrust", "step-up", "wall sit",
];

function getExerciseBranch(name: string): Branch {
  const n = name.toLowerCase();
  if (PUSH_KEYWORDS.some(k => n.includes(k))) return "PUSH";
  if (PULL_KEYWORDS.some(k => n.includes(k))) return "PULL";
  if (LEGS_KEYWORDS.some(k => n.includes(k))) return "LEGS";
  return "CORE";
}

const BRANCH_STYLES: Record<Branch, { label: string; bg: string; text: string; border: string }> = {
  PUSH: { label: "Push", bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/30" },
  PULL: { label: "Pull", bg: "bg-blue-500/15",   text: "text-blue-400",   border: "border-blue-500/30"   },
  CORE: { label: "Core", bg: "bg-yellow-500/15", text: "text-yellow-400", border: "border-yellow-500/30" },
  LEGS: { label: "Legs", bg: "bg-green-500/15",  text: "text-green-400",  border: "border-green-500/30"  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function History() {
  const { data: sessions, isLoading } = useListSessions();
  const { t } = useTranslation();

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("history.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("history.subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : sessions?.length === 0 ? (
        <div className="text-center py-20 border border-dashed rounded-lg">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
          <p className="font-semibold text-foreground mb-1">No workouts recorded yet.</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Complete a session from the Workout tab to see your progress here!
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions?.map(session => {
            const clip    = getClip(session.id);
            const hasClip = clip !== null;
            const branch  = getExerciseBranch(session.exerciseName ?? "");
            const bs      = BRANCH_STYLES[branch];
            const sets    = session.sets;

            return (
              <Link key={session.id} href={`/session/${session.id}`}>
                <Card className="hover:bg-secondary/50 transition-colors cursor-pointer group">
                  <CardContent className="p-5 flex items-center justify-between gap-4">
                    {/* ── Left: exercise info ── */}
                    <div className="space-y-1.5 min-w-0">
                      <h3 className="font-bold text-lg group-hover:text-primary transition-colors flex items-center gap-2 flex-wrap">
                        {session.exerciseName}

                        {/* Branch pill */}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${bs.bg} ${bs.text} ${bs.border}`}>
                          {bs.label}
                        </span>

                        {/* Verified / self-reported badge */}
                        {session.isVerified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                            style={{ boxShadow: "0 0 6px 0 rgba(16,185,129,0.25)" }}>
                            <ShieldCheck className="w-2.5 h-2.5" />
                            {t("history.aiVerified")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted/60 border border-border text-muted-foreground">
                            <PenLine className="w-2.5 h-2.5" />
                            {t("history.selfReported")}
                          </span>
                        )}

                        {/* Clip indicator */}
                        {hasClip && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 border border-blue-500/30 text-blue-400">
                            <Video className="w-2.5 h-2.5" />
                            {t("history.viewClip")}
                          </span>
                        )}
                      </h3>

                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className="w-4 h-4 shrink-0" />
                        {format(new Date(session.startedAt), "MMM d, yyyy • h:mm a")}
                      </div>
                    </div>

                    {/* ── Right: stats ── */}
                    <div className="flex items-center gap-5 sm:gap-7 shrink-0">
                      {/* Sets (only show if > 1) */}
                      {sets != null && sets > 1 && (
                        <div className="text-right hidden sm:block">
                          <div className="flex items-center justify-end gap-1 font-mono text-xl font-bold text-foreground">
                            <Layers className="w-4 h-4 text-muted-foreground" />
                            {sets}
                          </div>
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Sets
                          </div>
                        </div>
                      )}

                      {/* Reps */}
                      <div className="text-right">
                        <div className="font-mono text-2xl font-bold text-foreground">
                          {session.totalReps}
                        </div>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {t("history.reps")}
                        </div>
                      </div>

                      {/* Form score / RPE */}
                      <div className="text-right hidden sm:block">
                        {session.logType === "manual" ? (
                          <div className="flex flex-col items-end gap-1">
                            {session.rpe != null && (
                              <>
                                <div className="font-mono text-2xl font-bold text-foreground">
                                  {session.rpe}
                                  <span className="text-sm text-muted-foreground">/10</span>
                                </div>
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                  RPE
                                </div>
                              </>
                            )}
                          </div>
                        ) : !session.isVerified ? (
                          <div className="flex flex-col items-end gap-1">
                            <div className="font-mono text-2xl font-bold text-muted-foreground">
                              {session.avgFormScore ? Math.round(session.avgFormScore) : "--"}
                            </div>
                            <span className="text-[10px] font-medium text-amber-400 uppercase tracking-wider">
                              {t("history.unverified")}
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="font-mono text-2xl font-bold text-primary">
                              {session.avgFormScore ? Math.round(session.avgFormScore) : "--"}
                            </div>
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              {t("history.avgForm")}
                            </div>
                          </>
                        )}
                      </div>

                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Auto-delete policy info */}
      {(sessions?.some(s => getClip(s.id) !== null) ?? false) && (
        <p className="text-[11px] text-muted-foreground text-center">
          {t("history.clipPolicy")}
        </p>
      )}
    </div>
  );
}
