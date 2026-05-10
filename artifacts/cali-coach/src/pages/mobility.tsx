import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Flame, Pause, Play, SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExerciseMotionSnapshot } from "@/components/exercise-motion-snapshot";
import { useTranslation } from "react-i18next";
import { speak, setActiveVoiceProfile } from "@/lib/voice-service";
import { getVoiceCues, getVoiceProfile } from "@/lib/workout-preferences";
import { getWorkoutCue, getStretchCue } from "@/lib/cue-translations";
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

  // ── Sync the equipped voice profile ─────────────────────────────────────
  useEffect(() => {
    setActiveVoiceProfile(getVoiceProfile());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Speak the exercise coaching cue at the START of each stretch ─────────
  useEffect(() => {
    if (!getVoiceCues()) return;
    if (!currentStretch) return;
    const cue = getStretchCue(currentStretch.id, i18n.language) || currentStretch.coachingCue;
    const t = setTimeout(() => {
      speak(cue, "encouraging");
    }, 600);
    return () => clearTimeout(t);
  }, [stretchIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Voice cues at 30 s remaining and at 0 s ───────────────────────────────
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

  // ── Viewport + scroll lock ────────────────────────────────────────────────
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = "0";
    document.body.style.left = "0";
    document.body.style.width = "100vw";
    document.body.style.height = "100vh";
    document.body.style.overscrollBehavior = "none";
    document.body.style.touchAction = "none";
    return () => {
      document.documentElement.style.overflow = "auto";
      document.documentElement.style.overscrollBehavior = "";
      document.body.style.overflow = "auto";
      document.body.style.position = "static";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.width = "auto";
      document.body.style.height = "auto";
      document.body.style.overscrollBehavior = "";
      document.body.style.touchAction = "";
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentStretch) return null;

  // Progress arc for the timer ring
  const r = 44;
  const circ = 2 * Math.PI * r;
  const progress = secondsLeft / currentStretch.durationSeconds;
  const offset = circ * (1 - progress);

  return (
    <>
      {/* ─── Scoped CSS — injected once, never causes reflow ──────────────── */}
      <style>{`
        @keyframes ghostPulse  { 0%,100%{opacity:.68} 50%{opacity:1} }
        @keyframes skeletonFadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        #ms-shell {
          position: fixed; inset: 0;
          width: 100vw; height: 100dvh;
          background: var(--background);
          display: grid;
          grid-template-rows: 56px 60px 1fr 220px;
          overflow: hidden;
          touch-action: none;
          overscroll-behavior: none;
          user-select: none;
          -webkit-user-select: none;
          -webkit-tap-highlight-color: transparent;
          box-sizing: border-box;
        }
        #ms-shell *, #ms-shell *::before, #ms-shell *::after {
          box-sizing: border-box;
          touch-action: none;
          overscroll-behavior: none;
          -webkit-tap-highlight-color: transparent;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        #ms-shell *::-webkit-scrollbar { display: none; }
        #ms-shell button { touch-action: manipulation; cursor: pointer; }

        /* ── Row 1: header ── */
        #ms-header {
          display: flex; align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
        }
        #ms-header button {
          display: flex; align-items: center; gap: 6px;
          background: none; border: none;
          color: var(--muted-foreground);
          font-size: 13px; font-weight: 500;
        }
        #ms-controls { display: flex; align-items: center; gap: 18px; }

        /* ── Row 2: title band ── */
        #ms-title {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 0 24px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          overflow: hidden;
          flex-shrink: 0;
        }
        #ms-title .counter {
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--primary); line-height: 1;
          margin-bottom: 3px;
        }
        #ms-title h2 {
          font-size: 17px; font-weight: 800;
          margin: 0; line-height: 1.2;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        /* ── Row 3: skeleton stage ── */
        #ms-stage {
          display: flex; align-items: center; justify-content: center;
          padding: 12px 20px;
          overflow: hidden;
          min-height: 0;
        }
        #ms-stage .skeleton-wrap {
          width: 100%; height: 100%;
          max-width: 380px;
          animation: skeletonFadeIn 0.22s ease-out both;
        }
        #ms-stage .skeleton-wrap.pulsing {
          animation: skeletonFadeIn 0.22s ease-out both,
                     ghostPulse 2.6s ease-in-out 0.22s infinite;
        }
        #ms-stage .skeleton-wrap.paused { opacity: 0.38; }

        /* ── Row 4: info dock ── */
        #ms-dock {
          display: flex; flex-direction: column;
          align-items: center;
          padding: 14px 20px 20px;
          border-top: 1px solid rgba(255,255,255,0.06);
          gap: 10px;
          overflow: hidden;
          flex-shrink: 0;
        }
        #ms-dock .cue {
          font-size: 12px; line-height: 1.55;
          color: var(--muted-foreground);
          text-align: center;
          max-width: 300px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        #ms-dock .timer-row {
          display: flex; align-items: center; gap: 16px;
        }
        #ms-dock .timer-svg { flex-shrink: 0; }
        #ms-dock .timer-info { display: flex; flex-direction: column; gap: 6px; }
        #ms-dock .muscles {
          display: flex; flex-wrap: wrap; gap: 5px;
        }
        #ms-dock .muscle-pill {
          font-size: 10px; font-weight: 600;
          padding: 2px 9px;
          border-radius: 999px;
          background: rgba(255,255,255,0.06);
          color: var(--muted-foreground);
          border: 1px solid rgba(255,255,255,0.08);
        }
        #ms-dock .next-label {
          font-size: 11px; color: var(--muted-foreground);
          text-align: center;
        }
        #ms-dock .next-label strong { color: var(--foreground); }
        #ms-dock .last-label {
          font-size: 11px; font-weight: 700;
          color: var(--primary);
        }
      `}</style>

      <div id="ms-shell">

        {/* ── ROW 1: Header ──────────────────────────────────────────────── */}
        <div id="ms-header">
          <button onClick={onExit}>
            <ArrowLeft size={15} /> Exit
          </button>

          <ProgressDots total={routine.length} current={stretchIndex} done={secondsLeft === 0} />

          <div id="ms-controls">
            <button onClick={onPauseToggle} aria-label={paused ? "Resume" : "Pause"}>
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
            <button onClick={onSkip}>
              <SkipForward size={15} />
            </button>
          </div>
        </div>

        {/* ── ROW 2: Title band — animates per stretch ──────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            id="ms-title"
            key={`title-${stretchIndex}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            <div className="counter">Stretch {stretchIndex + 1} of {routine.length}</div>
            <h2>{currentStretch.name}</h2>
          </motion.div>
        </AnimatePresence>

        {/* ── ROW 3: Skeleton stage ─────────────────────────────────────── */}
        <div id="ms-stage">
          <AnimatePresence mode="wait">
            <motion.div
              key={`skeleton-${stretchIndex}`}
              className={cn(
                "skeleton-wrap",
                paused ? "paused" : secondsLeft > 0 ? "pulsing" : "",
              )}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <ExerciseMotionSnapshot
                exerciseName={currentStretch.name}
                color="#22c55e"
                glow={!paused}
                className="w-full h-full"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── ROW 4: Info dock — always visible, never moves ────────────── */}
        <div id="ms-dock">

          {/* Coaching cue — clamped to 2 lines, never pushes timer */}
          <AnimatePresence mode="wait">
            <motion.p
              key={`cue-${stretchIndex}`}
              className="cue"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {currentStretch.coachingCue}
            </motion.p>
          </AnimatePresence>

          {/* Timer + muscle tags side-by-side */}
          <div className="timer-row">
            {/* Arc timer */}
            <svg className="timer-svg" width={100} height={100} viewBox="0 0 100 100">
              <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={7} />
              <circle
                cx={50} cy={50} r={r}
                fill="none"
                stroke={paused ? "#475569" : "#22c55e"}
                strokeWidth={7}
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                transform="rotate(-90 50 50)"
                style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s ease" }}
              />
              <text x={50} y={46} textAnchor="middle" fill="#f8fafc" fontSize={24} fontWeight="800" fontFamily="monospace">
                {secondsLeft}
              </text>
              <text x={50} y={62} textAnchor="middle" fill={paused ? "#475569" : "#64748b"} fontSize={10}>
                {paused ? "paused" : "sec"}
              </text>
            </svg>

            {/* Muscle pills + next label */}
            <div className="timer-info">
              <div className="muscles">
                {currentStretch.targetMuscles.slice(0, 3).map((m) => (
                  <span key={m} className="muscle-pill">{m}</span>
                ))}
              </div>
              {isLast || !nextStretch
                ? <span className="last-label">Last stretch — finish strong!</span>
                : <span className="next-label">Next: <strong>{nextStretch.name}</strong></span>
              }
            </div>
          </div>

        </div>
      </div>
    </>
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
    const totalSeconds = routine.reduce((s, r) => s + r.durationSeconds, 0);
    const totalMin = Math.round(totalSeconds / 60);
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 60,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          touchAction: "none",
          overscrollBehavior: "none",
        }}
        className="bg-background px-6"
      >
        {/* ── Success Icon ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 20 }}
          className="w-24 h-24 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mb-8"
        >
          <CheckCircle2 className="w-12 h-12 text-primary" />
        </motion.div>

        {/* ── Heading ──────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.32, ease: "easeOut" }}
          className="text-center mb-6"
        >
          <h2 className="text-4xl font-extrabold tracking-tight mb-3">Session Complete!</h2>
          <p className="text-muted-foreground text-base leading-relaxed max-w-xs mx-auto">
            You completed {routine.length} stretch{routine.length !== 1 ? "es" : ""} in {totalMin} minute{totalMin !== 1 ? "s" : ""}.
          </p>
        </motion.div>

        {/* ── Stats row ────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.26, duration: 0.32, ease: "easeOut" }}
          className="flex gap-4 mb-8"
        >
          <div className="flex flex-col items-center px-5 py-3 rounded-2xl bg-card border border-border">
            <span className="text-2xl font-bold text-foreground">{routine.length}</span>
            <span className="text-xs text-muted-foreground mt-0.5">stretches</span>
          </div>
          <div className="flex flex-col items-center px-5 py-3 rounded-2xl bg-card border border-border">
            <span className="text-2xl font-bold text-foreground">{totalMin}m</span>
            <span className="text-xs text-muted-foreground mt-0.5">total time</span>
          </div>
          <div className="flex flex-col items-center px-5 py-3 rounded-2xl bg-orange-500/10 border border-orange-500/25">
            <span className="text-2xl font-bold text-orange-400 flex items-center gap-1">
              <Flame className="w-5 h-5" />{streak}
            </span>
            <span className="text-xs text-orange-400/70 mt-0.5">day streak</span>
          </div>
        </motion.div>

        {/* ── Buttons ──────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.34, duration: 0.32, ease: "easeOut" }}
          className="flex flex-col gap-3 w-full max-w-xs"
        >
          {onDismiss ? (
            <Button size="lg" className="w-full font-bold" onClick={onDismiss}>
              Back to Daily Tasks
            </Button>
          ) : (
            <Button size="lg" className="w-full font-bold" asChild>
              <Link href="/">Back to Dashboard</Link>
            </Button>
          )}
          <Button size="lg" variant="outline" className="w-full" onClick={startSession}>
            <Play className="w-4 h-4 mr-2" />
            Repeat Session
          </Button>
        </motion.div>
      </motion.div>
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
