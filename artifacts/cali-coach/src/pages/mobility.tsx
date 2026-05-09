import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Flame, Pause, Play, SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExerciseMotionSnapshot } from "@/components/exercise-motion-snapshot";
import { useTranslation } from "react-i18next";
import { speak } from "@/lib/voice-service";
import { getVoiceCues } from "@/lib/workout-preferences";
import { getWorkoutCue } from "@/lib/cue-translations";
import {
  getTasksForPreferences,
  routineDurationMinutes,
  GOAL_LABELS,
  type MobilityGoal,
  type Stretch,
  type StiffnessArea,
} from "@/lib/mobility-service";
import {
  useMobilityStatus,
  useCompleteMobility,
  useNotificationScheduler,
} from "@/lib/use-mobility";

// ─── Circular Countdown Timer ────────────────────────────────────────────────

function CircularTimer({
  secondsLeft,
  total,
  paused,
}: {
  secondsLeft: number;
  total: number;
  paused: boolean;
}) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - secondsLeft / total);

  return (
    <svg viewBox="0 0 120 120" width={148} height={148}>
      <circle cx={60} cy={60} r={r} fill="none" stroke="#1e293b" strokeWidth={8} />
      <circle
        cx={60}
        cy={60}
        r={r}
        fill="none"
        stroke={paused ? "#64748b" : "#22c55e"}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 60 60)"
        style={{ transition: "stroke-dashoffset 0.8s linear, stroke 0.3s ease" }}
      />
      <text x={60} y={56} textAnchor="middle" fill="#f8fafc" fontSize={30} fontWeight="bold" fontFamily="monospace">
        {secondsLeft}
      </text>
      <text x={60} y={76} textAnchor="middle" fill={paused ? "#64748b" : "#94a3b8"} fontSize={11}>
        {paused ? "paused" : "seconds"}
      </text>
    </svg>
  );
}

// ─── Stretch Progress Dots ───────────────────────────────────────────────────

function ProgressDots({
  total,
  current,
  done,
}: {
  total: number;
  current: number;
  done: boolean;
}) {
  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-2 h-2 rounded-full transition-colors duration-300",
            i < current
              ? "bg-primary"
              : i === current && !done
                ? "bg-primary/60 ring-2 ring-primary ring-offset-1 ring-offset-background"
                : "bg-muted-foreground/30",
          )}
        />
      ))}
    </div>
  );
}

// ─── Active Workout Player ────────────────────────────────────────────────────
// Extracted into its own component so that useEffect(fn,[]) fires exactly on
// mount (scroll lock) and unmount (scroll unlock) — not on pageState changes.

interface ActiveWorkoutPlayerProps {
  routine: Stretch[];
  stretchIndex: number;
  secondsLeft: number;
  paused: boolean;
  onExit: () => void;
  onSkip: () => void;
  onPauseToggle: () => void;
}

function ActiveWorkoutPlayer({
  routine,
  stretchIndex,
  secondsLeft,
  paused,
  onExit,
  onSkip,
  onPauseToggle,
}: ActiveWorkoutPlayerProps) {
  const currentStretch = routine[stretchIndex];
  const nextStretch = routine[stretchIndex + 1];
  const isLast = stretchIndex + 1 >= routine.length;

  const { i18n } = useTranslation();

  // ── Speak the exercise coaching cue at the START of each stretch ─────────
  // The English coachingCue text is sent to the backend where the LLM
  // rephrases it in character AND in the target language. If the LLM is
  // unavailable the raw text goes to ElevenLabs as-is (degraded: English audio).
  useEffect(() => {
    if (!getVoiceCues()) return;
    if (!currentStretch) return;
    const t = setTimeout(() => {
      speak(currentStretch.coachingCue, "encouraging");
    }, 600);
    return () => clearTimeout(t);
  }, [stretchIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Voice cues at 30 s remaining and at 0 s (stretch complete) ───────────
  // These use pre-translated text from cue-translations.ts so ElevenLabs
  // receives the correct language directly — no LLM dependency.
  const spokenRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (!getVoiceCues()) return;
    const key30 = `${stretchIndex}:30`;
    const key0  = `${stretchIndex}:0`;
    if (secondsLeft === 30 && !spokenRef.current[key30]) {
      spokenRef.current[key30] = true;
      speak(getWorkoutCue("30s", i18n.language), "encouraging");
    }
    if (secondsLeft === 0 && !spokenRef.current[key0]) {
      spokenRef.current[key0] = true;
      speak(getWorkoutCue("complete", i18n.language), "encouraging");
    }
  }, [secondsLeft, stretchIndex, i18n.language]);

  // ── SCROLL LOCK — fires exactly on mount, unlocks exactly on unmount ─────
  useEffect(() => {
    window.scrollTo(0, 0);

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = "0";
    document.body.style.left = "0";
    document.body.style.width = "100vw";
    document.body.style.height = "100vh";

    return () => {
      document.documentElement.style.overflow = "auto";
      document.body.style.overflow = "auto";
      document.body.style.position = "static";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.width = "auto";
      document.body.style.height = "auto";
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentStretch) return null;

  return (
    <div
      id="workout-shell"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        maxWidth: "100vw",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
      className="bg-background"
    >
      {/* ── TOP: Exit · ProgressDots · Pause · Skip ───────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <button
          onClick={onExit}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}
        >
          <ArrowLeft size={16} />
          Exit
        </button>

        <ProgressDots
          total={routine.length}
          current={stretchIndex}
          done={secondsLeft === 0}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={onPauseToggle}
            aria-label={paused ? "Resume" : "Pause"}
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button
            onClick={onSkip}
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}
          >
            Skip <SkipForward size={14} />
          </button>
        </div>
      </div>

      {/* ── BODY: 3 zones, space-between ──────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          overflow: "hidden",
          padding: "12px 16px 16px",
          maxWidth: 448,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={stretchIndex}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", flex: 1, width: "100%", minHeight: 0 }}
          >
            {/* ZONE 1 — label */}
            <div style={{ textAlign: "center", width: "100%", flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: "var(--primary)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>
                Stretch {stretchIndex + 1} of {routine.length}
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, margin: 0 }}>{currentStretch.name}</h2>
            </div>

            {/* ZONE 2 — 3-panel snapshot */}
            <div
              className={cn(
                "w-full",
                paused ? "opacity-50" : secondsLeft === 0 ? "opacity-100" : "[animation:ghostPulse_2.5s_ease-in-out_infinite]",
              )}
              style={{ flex: "1 1 0", minHeight: 0, maxHeight: 240, display: "flex", alignItems: "center", width: "100%", overflow: "hidden" }}
            >
              <ExerciseMotionSnapshot
                exerciseName={currentStretch.name}
                color="#22c55e"
                glow={!paused}
                className="w-full h-full"
              />
            </div>

            {/* ZONE 3 — timer + info */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%", flexShrink: 0 }}>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", textAlign: "center", maxWidth: 280, lineHeight: 1.5, margin: 0, padding: "0 8px" }}>
                {currentStretch.coachingCue}
              </p>

              <CircularTimer secondsLeft={secondsLeft} total={currentStretch.durationSeconds} paused={paused} />

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                {currentStretch.targetMuscles.map((m) => (
                  <span key={m} className="px-2.5 py-0.5 rounded-full bg-muted text-xs text-muted-foreground">{m}</span>
                ))}
              </div>

              <div style={{ fontSize: 12, textAlign: "center" }}>
                {!isLast && nextStretch
                  ? <span style={{ color: "var(--muted-foreground)" }}>Next: <strong>{nextStretch.name}</strong></span>
                  : <span style={{ color: "var(--primary)", fontWeight: 600 }}>Last stretch — finish strong!</span>}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes ghostPulse { 0%,100%{opacity:.72} 50%{opacity:1} }
        #workout-shell, #workout-shell * {
          scrollbar-width: none; -ms-overflow-style: none;
          max-width: 100vw; box-sizing: border-box;
        }
        #workout-shell::-webkit-scrollbar, #workout-shell *::-webkit-scrollbar {
          display: none; width: 0; height: 0;
        }
      `}</style>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type PageState = "ready" | "active" | "done";

const LS_PREFS_KEY = "calicoach:dailyPrefs";
interface CachedPrefs { mobilityGoal: string; stiffnessAreas: string; dailyTimeMinutes: number }
function readCachedPrefs(): CachedPrefs | null {
  try { const r = localStorage.getItem(LS_PREFS_KEY); return r ? JSON.parse(r) as CachedPrefs : null; }
  catch { return null; }
}

export function MobilityPage({ onDismiss, autoStart = false }: { onDismiss?: () => void; autoStart?: boolean } = {}) {
  const [, setLocation] = useLocation();
  const { data: status } = useMobilityStatus();
  const completeMobility = useCompleteMobility();

  useNotificationScheduler(status);

  const cached = readCachedPrefs();
  const goal = ((status?.settings.mobilityGoal ?? cached?.mobilityGoal ?? "general")) as MobilityGoal;
  const goalLabel = GOAL_LABELS[goal] ?? goal;

  const rawAreas = status?.settings.stiffnessAreas ?? cached?.stiffnessAreas ?? "";
  const areasArray = rawAreas ? (rawAreas.split(",").filter(Boolean) as StiffnessArea[]) : [];
  const dailyTimeMinutes = status?.settings.dailyTimeMinutes ?? cached?.dailyTimeMinutes ?? 10;

  const routine = getTasksForPreferences(goal, areasArray, dailyTimeMinutes);

  const [pageState, setPageState] = useState<PageState>(autoStart ? "active" : "ready");
  const [stretchIndex, setStretchIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finalStreak, setFinalStreak] = useState<number | null>(null);

  const currentStretch: Stretch | undefined = routine[stretchIndex];

  // ── Hard-scroll to origin on mount ──────────────────────────────────────────
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // ── Reset timer + pause state when exercise changes ─────────────────────────
  useEffect(() => {
    if (pageState !== "active") return;
    if (!currentStretch) return;
    setSecondsLeft(currentStretch.durationSeconds);
    setPaused(false);
  }, [pageState, stretchIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tick the timer when active and not paused ───────────────────────────────
  useEffect(() => {
    if (pageState !== "active" || paused || secondsLeft === 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(interval); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pageState, paused, stretchIndex]); // restart interval on exercise change / pause toggle

  // ── Auto-advance when timer hits zero ──────────────────────────────────────
  useEffect(() => {
    if (pageState !== "active" || secondsLeft !== 0) return;
    const t = setTimeout(() => advanceStretch(), 600);
    return () => clearTimeout(t);
  }, [secondsLeft, pageState]); // eslint-disable-line react-hooks/exhaustive-deps

  const advanceStretch = useCallback(() => {
    if (stretchIndex + 1 >= routine.length) {
      completeSession();
    } else {
      setStretchIndex((i) => i + 1);
    }
  }, [stretchIndex, routine.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function completeSession() {
    completeMobility.mutate(
      { goal },
      {
        onSuccess: (data) => {
          setFinalStreak((data as { currentStreak: number }).currentStreak);
          setPageState("done");
        },
        onError: () => {
          setFinalStreak(status?.currentStreak ?? 1);
          setPageState("done");
        },
      },
    );
  }

  function startSession() {
    setStretchIndex(0);
    setPaused(false);
    setPageState("active");
  }

  function exitSession() {
    setPaused(false);
    // Always strip the scroll-lock class in case this is standalone route usage
    document.documentElement.classList.remove("workout-active");
    document.body.classList.remove("workout-active");
    if (onDismiss) {
      onDismiss();
    } else {
      setLocation("/");
    }
  }

  // ── READY STATE ──────────────────────────────────────────────────────────
  if (pageState === "ready") {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          {onDismiss ? (
            <Button variant="ghost" size="icon" onClick={onDismiss} className="shrink-0">
              <X className="w-5 h-5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <Link href="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold">Daily Mobility</h1>
            <p className="text-sm text-muted-foreground">Goal: {goalLabel}</p>
          </div>
          {(status?.currentStreak ?? 0) > 0 && (
            <div className="ml-auto flex items-center gap-1.5 bg-orange-500/10 text-orange-400 rounded-full px-3 py-1 text-sm font-semibold">
              <Flame className="w-4 h-4" />
              {status?.currentStreak} day streak
            </div>
          )}
        </div>

        {status?.completedToday && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-primary/10 border border-primary/30 text-primary">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">
              You've already completed today's session — well done!
            </span>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{routine.length} stretches</span>
            <span>~{routineDurationMinutes(routine)} min total</span>
          </div>

          <div className="space-y-3">
            {routine.map((stretch, i) => (
              <div
                key={stretch.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/50"
              >
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{stretch.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {stretch.targetMuscles.slice(0, 2).join(" · ")}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground font-mono shrink-0">
                  {stretch.durationSeconds}s
                </div>
              </div>
            ))}
          </div>

          <Button onClick={startSession} className="w-full font-bold" size="lg">
            <Play className="w-5 h-5 mr-2" />
            {status?.completedToday ? "Repeat Session" : "Begin Session"}
          </Button>
        </div>
      </div>
    );
  }

  // ── DONE STATE ──────────────────────────────────────────────────────────────
  if (pageState === "done") {
    const streak = finalStreak ?? 1;
    return (
      <div className="p-6 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-primary" />
        </div>

        <div>
          <h2 className="text-3xl font-bold mb-2">Session Complete!</h2>
          <p className="text-muted-foreground">
            You held {routine.length} stretches for {routine[0]?.durationSeconds ?? 60}s each.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-orange-500/10 text-orange-400 rounded-full px-5 py-2.5 text-lg font-bold">
          <Flame className="w-5 h-5" />
          {streak}-day mobility streak!
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={startSession}>
            Repeat Session
          </Button>
          {onDismiss ? (
            <Button onClick={onDismiss}>Back to Daily Tasks</Button>
          ) : (
            <Button asChild>
              <Link href="/">Back to Dashboard</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── ACTIVE STATE — rendered by its own component which owns the scroll lock ──
  if (pageState === "active") {
    return (
      <ActiveWorkoutPlayer
        routine={routine}
        stretchIndex={stretchIndex}
        secondsLeft={secondsLeft}
        paused={paused}
        onExit={exitSession}
        onSkip={advanceStretch}
        onPauseToggle={() => setPaused((p) => !p)}
      />
    );
  }

  return null;
}
