import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Flame, Pause, Play, SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExerciseMotionSnapshot } from "@/components/exercise-motion-snapshot";
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

// ─── Main Component ───────────────────────────────────────────────────────────

type PageState = "ready" | "active" | "done";

const LS_PREFS_KEY = "calicoach:dailyPrefs";
interface CachedPrefs { mobilityGoal: string; stiffnessAreas: string; dailyTimeMinutes: number }
function readCachedPrefs(): CachedPrefs | null {
  try { const r = localStorage.getItem(LS_PREFS_KEY); return r ? JSON.parse(r) as CachedPrefs : null; }
  catch { return null; }
}

export function MobilityPage({ onDismiss, autoStart = false }: { onDismiss?: () => void; autoStart?: boolean } = {}) {
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

  // ── Hard-scroll to origin on mount so the overlay always starts at the top ──
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
    setPageState("ready");
    setStretchIndex(0);
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

  // ── ACTIVE STATE ────────────────────────────────────────────────────────────
  if (!currentStretch) return null;

  const nextStretch = routine[stretchIndex + 1];
  const isLast = stretchIndex + 1 >= routine.length;

  return (
    <div className="flex flex-col bg-background" style={{ height: "100dvh", overflow: "hidden" }}>

      {/* ── Header: always pinned at top ──────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0 gap-2">
        <button
          onClick={exitSession}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Exit
        </button>

        <ProgressDots
          total={routine.length}
          current={stretchIndex}
          done={secondsLeft === 0}
        />

        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={() => setPaused((p) => !p)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label={paused ? "Resume" : "Pause"}
          >
            {paused
              ? <Play className="w-3.5 h-3.5" />
              : <Pause className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={advanceStretch}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Body: fills remaining height, distributes items evenly ────────── */}
      <div className="flex-1 flex flex-col items-center justify-around min-h-0 px-4 py-2 max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={stretchIndex}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full flex flex-col items-center justify-around flex-1 gap-0"
            style={{ minHeight: 0 }}
          >

            {/* Exercise label */}
            <div className="text-center shrink-0">
              <div className="text-[10px] text-primary font-bold tracking-widest uppercase mb-0.5">
                Stretch {stretchIndex + 1} of {routine.length}
              </div>
              <h2 className="text-lg font-bold leading-tight">{currentStretch.name}</h2>
            </div>

            {/* 3-panel motion snapshot — scales with viewport height */}
            <div
              className={cn(
                "w-full shrink-0",
                paused
                  ? "opacity-50"
                  : secondsLeft === 0
                    ? "opacity-100"
                    : "[animation:ghostPulse_2.5s_ease-in-out_infinite]",
              )}
              style={{ height: "28vh", maxHeight: 220 }}
            >
              <ExerciseMotionSnapshot
                exerciseName={currentStretch.name}
                color="#22c55e"
                glow={!paused}
                className="w-full h-full"
              />
            </div>

            {/* Coaching cue */}
            <p className="text-xs text-muted-foreground text-center max-w-xs leading-relaxed shrink-0 px-2">
              {currentStretch.coachingCue}
            </p>

            {/* Circular timer — viewport-scaled */}
            <div className="shrink-0">
              <CircularTimer
                secondsLeft={secondsLeft}
                total={currentStretch.durationSeconds}
                paused={paused}
              />
            </div>

            {/* Muscle group tags */}
            <div className="flex flex-wrap gap-1.5 justify-center shrink-0">
              {currentStretch.targetMuscles.map((m) => (
                <span
                  key={m}
                  className="px-2.5 py-0.5 rounded-full bg-muted text-xs text-muted-foreground"
                >
                  {m}
                </span>
              ))}
            </div>

            {/* Next up / finish line */}
            <div className="text-xs text-center shrink-0">
              {!isLast && nextStretch
                ? <span className="text-muted-foreground/70">Next: <span className="text-muted-foreground font-medium">{nextStretch.name}</span></span>
                : <span className="text-primary/70 font-medium">Last stretch — finish strong!</span>}
            </div>

          </motion.div>
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes ghostPulse {
          0%, 100% { opacity: 0.72; }
          50%       { opacity: 1;    }
        }
      `}</style>
    </div>
  );
}
