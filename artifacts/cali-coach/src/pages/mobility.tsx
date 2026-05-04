import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, Flame, Play, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getRoutineForGoal,
  routineDurationMinutes,
  GOAL_LABELS,
  type GhostPose,
  type MobilityGoal,
  type Stretch,
} from "@/lib/mobility-service";
import {
  useMobilityStatus,
  useCompleteMobility,
  useNotificationScheduler,
} from "@/lib/use-mobility";

// ─── Ghost Pose SVG ──────────────────────────────────────────────────────────

function GhostFigure({ pose }: { pose: GhostPose }) {
  const stroke = "#22c55e";
  const sw = "4";
  const sw2 = "5";
  const cap = "round";

  const poses: Record<GhostPose, React.ReactNode> = {
    "standing-arms-wide": (
      <>
        <circle cx="50" cy="10" r="8" fill="none" strokeWidth={sw2} />
        <line x1="50" y1="18" x2="50" y2="62" strokeWidth={sw} />
        <line x1="8" y1="38" x2="92" y2="38" strokeWidth={sw} />
        <line x1="50" y1="62" x2="32" y2="105" strokeWidth={sw} />
        <line x1="50" y1="62" x2="68" y2="105" strokeWidth={sw} />
      </>
    ),
    "standing-arm-up": (
      <>
        <circle cx="50" cy="10" r="8" fill="none" strokeWidth={sw2} />
        <line x1="50" y1="18" x2="50" y2="62" strokeWidth={sw} />
        <line x1="50" y1="36" x2="18" y2="52" strokeWidth={sw} />
        <line x1="50" y1="36" x2="74" y2="8" strokeWidth={sw} />
        <line x1="50" y1="62" x2="32" y2="105" strokeWidth={sw} />
        <line x1="50" y1="62" x2="68" y2="105" strokeWidth={sw} />
      </>
    ),
    "kneeling-forward": (
      <>
        <circle cx="50" cy="10" r="8" fill="none" strokeWidth={sw2} />
        <line x1="50" y1="18" x2="50" y2="55" strokeWidth={sw} />
        <line x1="50" y1="42" x2="25" y2="68" strokeWidth={sw} />
        <line x1="50" y1="42" x2="75" y2="68" strokeWidth={sw} />
        <line x1="50" y1="55" x2="35" y2="80" strokeWidth={sw} />
        <line x1="50" y1="55" x2="65" y2="80" strokeWidth={sw} />
        <line x1="35" y1="80" x2="28" y2="100" strokeWidth={sw} />
        <line x1="65" y1="80" x2="72" y2="100" strokeWidth={sw} />
      </>
    ),
    "seated-twist": (
      <>
        <circle cx="50" cy="10" r="8" fill="none" strokeWidth={sw2} />
        <line x1="50" y1="18" x2="50" y2="55" strokeWidth={sw} />
        <line x1="50" y1="34" x2="78" y2="22" strokeWidth={sw} />
        <line x1="50" y1="34" x2="22" y2="46" strokeWidth={sw} />
        <line x1="50" y1="55" x2="18" y2="72" strokeWidth={sw} />
        <line x1="50" y1="55" x2="82" y2="72" strokeWidth={sw} />
        <line x1="18" y1="72" x2="38" y2="90" strokeWidth={sw} />
        <line x1="82" y1="72" x2="62" y2="90" strokeWidth={sw} />
      </>
    ),
    lunge: (
      <>
        <circle cx="45" cy="10" r="8" fill="none" strokeWidth={sw2} />
        <line x1="45" y1="18" x2="45" y2="55" strokeWidth={sw} />
        <line x1="45" y1="34" x2="18" y2="28" strokeWidth={sw} />
        <line x1="45" y1="34" x2="72" y2="28" strokeWidth={sw} />
        <line x1="45" y1="55" x2="28" y2="78" strokeWidth={sw} />
        <line x1="28" y1="78" x2="26" y2="100" strokeWidth={sw} />
        <line x1="45" y1="55" x2="72" y2="75" strokeWidth={sw} />
        <line x1="72" y1="75" x2="85" y2="88" strokeWidth={sw} />
      </>
    ),
    "forward-fold": (
      <>
        <circle cx="50" cy="68" r="8" fill="none" strokeWidth={sw2} />
        <line x1="50" y1="62" x2="50" y2="60" strokeWidth={sw} />
        <line x1="50" y1="24" x2="50" y2="60" strokeWidth={sw} />
        <line x1="50" y1="24" x2="33" y2="110" strokeWidth={sw} />
        <line x1="50" y1="24" x2="67" y2="110" strokeWidth={sw} />
        <line x1="50" y1="60" x2="28" y2="88" strokeWidth={sw} />
        <line x1="50" y1="60" x2="72" y2="88" strokeWidth={sw} />
      </>
    ),
    hanging: (
      <>
        <line x1="12" y1="12" x2="88" y2="12" strokeWidth="6" />
        <line x1="38" y1="12" x2="32" y2="28" strokeWidth={sw} />
        <line x1="62" y1="12" x2="68" y2="28" strokeWidth={sw} />
        <circle cx="50" cy="36" r="8" fill="none" strokeWidth={sw2} />
        <line x1="50" y1="44" x2="50" y2="85" strokeWidth={sw} />
        <line x1="50" y1="85" x2="34" y2="115" strokeWidth={sw} />
        <line x1="50" y1="85" x2="66" y2="115" strokeWidth={sw} />
      </>
    ),
    "kneeling-backward": (
      <>
        <circle cx="50" cy="10" r="8" fill="none" strokeWidth={sw2} />
        <line x1="50" y1="18" x2="50" y2="55" strokeWidth={sw} />
        <line x1="50" y1="42" x2="28" y2="68" strokeWidth={sw} />
        <line x1="50" y1="42" x2="72" y2="68" strokeWidth={sw} />
        <line x1="15" y1="68" x2="85" y2="68" strokeWidth="3" />
        <line x1="50" y1="55" x2="35" y2="80" strokeWidth={sw} />
        <line x1="50" y1="55" x2="65" y2="80" strokeWidth={sw} />
        <line x1="35" y1="80" x2="28" y2="100" strokeWidth={sw} />
        <line x1="65" y1="80" x2="72" y2="100" strokeWidth={sw} />
      </>
    ),
    "wide-seated": (
      <>
        <circle cx="50" cy="10" r="8" fill="none" strokeWidth={sw2} />
        <line x1="50" y1="18" x2="50" y2="55" strokeWidth={sw} />
        <line x1="50" y1="34" x2="28" y2="48" strokeWidth={sw} />
        <line x1="50" y1="34" x2="72" y2="48" strokeWidth={sw} />
        <line x1="50" y1="55" x2="8"  y2="70" strokeWidth={sw} />
        <line x1="50" y1="55" x2="92" y2="70" strokeWidth={sw} />
        <line x1="8"  y1="70" x2="4"  y2="88" strokeWidth={sw} />
        <line x1="92" y1="70" x2="96" y2="88" strokeWidth={sw} />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 100 120"
      className="w-full h-full"
      stroke={stroke}
      strokeLinecap={cap as "round"}
      strokeLinejoin={cap as "round"}
      fill="none"
    >
      {poses[pose]}
    </svg>
  );
}

// ─── Circular Countdown Timer ────────────────────────────────────────────────

function CircularTimer({
  secondsLeft,
  total,
}: {
  secondsLeft: number;
  total: number;
}) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - secondsLeft / total);

  return (
    <svg viewBox="0 0 120 120" width={160} height={160}>
      <circle cx={60} cy={60} r={r} fill="none" stroke="#1e293b" strokeWidth={8} />
      <circle
        cx={60}
        cy={60}
        r={r}
        fill="none"
        stroke="#22c55e"
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 60 60)"
        style={{ transition: "stroke-dashoffset 0.8s linear" }}
      />
      <text x={60} y={56} textAnchor="middle" fill="#f8fafc" fontSize={30} fontWeight="bold" fontFamily="monospace">
        {secondsLeft}
      </text>
      <text x={60} y={76} textAnchor="middle" fill="#94a3b8" fontSize={11}>
        seconds
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
            "w-2.5 h-2.5 rounded-full transition-colors duration-300",
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

// ─── Main Page ───────────────────────────────────────────────────────────────

type PageState = "ready" | "active" | "done";

export function MobilityPage() {
  const [, setLocation] = useLocation();
  const { data: status } = useMobilityStatus();
  const completeMobility = useCompleteMobility();

  useNotificationScheduler(status);

  const goal = (status?.settings.mobilityGoal ?? "general") as MobilityGoal;
  const routine = getRoutineForGoal(goal);
  const goalLabel = GOAL_LABELS[goal];

  const [pageState, setPageState] = useState<PageState>("ready");
  const [stretchIndex, setStretchIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [finalStreak, setFinalStreak] = useState<number | null>(null);

  const currentStretch: Stretch | undefined = routine[stretchIndex];

  // ── Timer logic ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (pageState !== "active") return;
    if (!currentStretch) return;

    setSecondsLeft(currentStretch.durationSeconds);
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pageState, stretchIndex, currentStretch]);

  // Auto-advance when timer hits 0
  useEffect(() => {
    if (pageState !== "active" || secondsLeft !== 0) return;
    const t = setTimeout(() => advanceStretch(), 600);
    return () => clearTimeout(t);
  }, [secondsLeft, pageState]);

  const advanceStretch = useCallback(() => {
    if (stretchIndex + 1 >= routine.length) {
      completeSession();
    } else {
      setStretchIndex((i) => i + 1);
    }
  }, [stretchIndex, routine.length]);

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
    setPageState("active");
  }

  function exitSession() {
    setPageState("ready");
    setStretchIndex(0);
  }

  // ── READY STATE ────────────────────────────────────────────────────────────
  if (pageState === "ready") {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
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

          <Button
            onClick={startSession}
            className="w-full font-bold"
            size="lg"
          >
            <Play className="w-5 h-5 mr-2" />
            {status?.completedToday ? "Repeat Session" : "Begin Session"}
          </Button>
        </div>
      </div>
    );
  }

  // ── DONE STATE ─────────────────────────────────────────────────────────────
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
          <Button variant="outline" onClick={() => { setPageState("ready"); setStretchIndex(0); }}>
            Do Again
          </Button>
          <Button asChild>
            <Link href="/">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── ACTIVE STATE ───────────────────────────────────────────────────────────
  if (!currentStretch) return null;

  const nextStretch = routine[stretchIndex + 1];
  const isLast = stretchIndex + 1 >= routine.length;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button
          onClick={exitSession}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Exit
        </button>
        <ProgressDots
          total={routine.length}
          current={stretchIndex}
          done={secondsLeft === 0}
        />
        <button
          onClick={advanceStretch}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip
          <SkipForward className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Ghost Pose */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 gap-6">
        {/* Ghost figure */}
        <div
          className={cn(
            "w-44 h-52 transition-all duration-500",
            secondsLeft === 0
              ? "opacity-100"
              : "opacity-100 [animation:ghostPulse_2.5s_ease-in-out_infinite]",
          )}
          style={{
            filter:
              "drop-shadow(0 0 16px rgba(34,197,94,0.5)) drop-shadow(0 0 4px rgba(34,197,94,0.8))",
          }}
        >
          <GhostFigure pose={currentStretch.pose} />
        </div>

        {/* Stretch label */}
        <div className="text-center space-y-1">
          <div className="text-xs text-primary font-semibold tracking-widest uppercase">
            Stretch {stretchIndex + 1} of {routine.length}
          </div>
          <h2 className="text-2xl font-bold">{currentStretch.name}</h2>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            {currentStretch.coachingCue}
          </p>
        </div>

        {/* Countdown */}
        <CircularTimer secondsLeft={secondsLeft} total={currentStretch.durationSeconds} />

        {/* Muscle targets */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          {currentStretch.targetMuscles.map((m) => (
            <span
              key={m}
              className="px-2.5 py-0.5 rounded-full bg-muted text-xs text-muted-foreground"
            >
              {m}
            </span>
          ))}
        </div>

        {/* Next up */}
        {!isLast && nextStretch && (
          <div className="text-xs text-muted-foreground/70 text-center">
            Next: <span className="text-muted-foreground font-medium">{nextStretch.name}</span>
          </div>
        )}
        {isLast && (
          <div className="text-xs text-primary/70 text-center font-medium">
            Last stretch — finish strong!
          </div>
        )}
      </div>

      {/* Description card at bottom */}
      <div className="p-4 border-t border-border bg-card/50">
        <p className="text-xs text-muted-foreground text-center leading-relaxed max-w-sm mx-auto">
          {currentStretch.description}
        </p>
      </div>

      <style>{`
        @keyframes ghostPulse {
          0%, 100% { opacity: 0.65; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
