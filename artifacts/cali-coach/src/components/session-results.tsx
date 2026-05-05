/**
 * SessionResults overlay
 *
 * Shown after every workout stop. Displays:
 *  - Form Mastery: animated SVG ring with the average form score
 *  - "Perfect Set" golden badge when ≥ PERFECT_SET_MIN_REPS reps at ≥ PERFECT_SET_MIN_FORM%
 *  - Skill node progress bar animating from the previous count to the new count
 *  - "Skill Unlocked!" banner + canvas confetti when a node crosses mastery
 *  - Action buttons: View Session  /  Continue (or Train Next if a new skill unlocked)
 */

import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Trophy, Star, ChevronRight, Zap, Ghost } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type EvaluatedSkill } from "@/lib/skill-tree";
import { getExerciseConfig } from "@/lib/exercise-registry";

// ─── Thresholds ───────────────────────────────────────────────────────────────

export const PERFECT_SET_MIN_REPS = 8;
export const PERFECT_SET_MIN_FORM = 95;

// ─── Branch colours (mirror skill-map.tsx) ────────────────────────────────────

const BRANCH_COLOR: Record<string, string> = {
  PUSH: "#f97316",
  PULL: "#3b82f6",
  CORE: "#a855f7",
  LEGS: "#10b981",
};

// ─── Canvas confetti ──────────────────────────────────────────────────────────

function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const COLORS = [
      "#eab308", "#f97316", "#10b981",
      "#3b82f6", "#a855f7", "#ec4899", "#ffffff",
    ];

    const particles = Array.from({ length: 100 }, () => ({
      x:     Math.random() * canvas.width,
      y:    -20 - Math.random() * canvas.height * 0.3,
      w:     5 + Math.random() * 9,
      h:     3 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      speed: 2.5 + Math.random() * 4.5,
      angle: Math.random() * Math.PI * 2,
      spin:  (Math.random() - 0.5) * 0.14,
      drift: (Math.random() - 0.5) * 1.6,
    }));

    let rafId: number;
    let halted = false;

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let live = 0;

      for (const p of particles) {
        p.y     += p.speed;
        p.x     += p.drift;
        p.angle += p.spin;
        if (p.y < canvas.height + 30) live++;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (live > 0 && !halted) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    const killTimer = window.setTimeout(() => { halted = true; }, 5500);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(killTimer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[60]"
    />
  );
}

// ─── Animated form ring ───────────────────────────────────────────────────────

function FormRing({ score }: { score: number | null }) {
  const [animPct, setAnimPct] = useState(0);

  const R    = 52;
  const SW   = 8;
  const circ = 2 * Math.PI * (R - SW / 2);

  const effectiveScore = score ?? 0;

  const color =
    score === null  ? "#64748b" :
    score >= 95     ? "#eab308" :
    score >= 80     ? "#10b981" :
    score >= 65     ? "#3b82f6" :
                      "#f97316";

  useEffect(() => {
    const t = setTimeout(() => setAnimPct(score !== null ? score / 100 : 0), 250);
    return () => clearTimeout(t);
  }, [score]);

  const cx = R + SW / 2;
  const cy = R + SW / 2;

  return (
    <svg width={cx * 2} height={cy * 2} className="mx-auto block">
      {/* track */}
      <circle
        cx={cx} cy={cy} r={R - SW / 2}
        fill="none" stroke="#1e293b" strokeWidth={SW}
      />
      {/* fill arc */}
      <circle
        cx={cx} cy={cy} r={R - SW / 2}
        fill="none"
        stroke={color}
        strokeWidth={SW}
        strokeDasharray={`${animPct * circ} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dasharray 1.1s cubic-bezier(0.22,1,0.36,1)" }}
      />
      {/* score */}
      <text
        x={cx} y={cy - 7}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={score === null ? 14 : 22} fontWeight="700" fill={color}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {score === null ? "—" : Math.round(effectiveScore)}
      </text>
      <text
        x={cx} y={cy + 16}
        textAnchor="middle"
        fontSize={9} fill="#64748b" letterSpacing="0.08em"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {score === null ? "MANUAL LOG" : "FORM MASTERY"}
      </text>
    </svg>
  );
}

// ─── Skill progress bar ───────────────────────────────────────────────────────

function SkillProgressBar({
  node,
  prevQualifying,
  nextQualifying,
  newlyMastered,
}: {
  node: EvaluatedSkill;
  prevQualifying: number;
  nextQualifying: number;
  newlyMastered: boolean;
}) {
  const total   = node.masteryRequirement.minQualifyingSessions;
  const prevPct = Math.min(1, prevQualifying / total);
  const nextPct = Math.min(1, nextQualifying  / total);
  const gained  = nextQualifying - prevQualifying;
  const color   = BRANCH_COLOR[node.branch] ?? "#3b82f6";

  const [barPct, setBarPct] = useState(prevPct);

  useEffect(() => {
    const t = setTimeout(() => setBarPct(nextPct), 650);
    return () => clearTimeout(t);
  }, [nextPct]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">{node.title}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {nextQualifying} / {total} sessions
        </span>
      </div>

      <div className="relative h-3 rounded-full overflow-hidden bg-secondary">
        {/* Previous fill (underneath) */}
        <div
          className="absolute inset-y-0 left-0 rounded-full opacity-30"
          style={{ width: `${prevPct * 100}%`, backgroundColor: color }}
        />
        {/* Animating fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${barPct * 100}%`,
            backgroundColor: color,
            transition: "width 1.1s cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      </div>

      {gained > 0 && (
        <p className="text-xs text-muted-foreground">
          {newlyMastered
            ? "Skill complete — next level unlocked!"
            : `+${Math.round((gained / total) * 100)}% progress this set`}
        </p>
      )}
    </div>
  );
}

// ─── Props & main component ───────────────────────────────────────────────────

export interface SessionResultsProps {
  exerciseName: string;
  totalReps: number;
  avgFormScore: number | null;
  sessionId: number;
  /** Best ghost-sync percentage achieved during the session (0–100). Undefined when ghost mode was not active (e.g. test mode). */
  bestSyncPct?: number;
  /** Skill tree evaluated BEFORE this session was included */
  prevEvaluated: EvaluatedSkill[];
  /** Skill tree evaluated AFTER this session is included */
  nextEvaluated: EvaluatedSkill[];
  onClose: () => void;
}

export function SessionResults({
  exerciseName,
  totalReps,
  avgFormScore,
  sessionId,
  bestSyncPct,
  prevEvaluated,
  nextEvaluated,
  onClose,
}: SessionResultsProps) {
  const [, navigate] = useLocation();

  const exerciseConfig = getExerciseConfig(exerciseName);
  const isStatic = exerciseConfig?.isStatic === true;

  /** Format seconds as "Xs" or "Xm Ys" */
  function formatHold(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${seconds}s`;
  }

  const isPerfectSet =
    !isStatic &&
    avgFormScore !== null &&
    totalReps    >= PERFECT_SET_MIN_REPS &&
    avgFormScore >= PERFECT_SET_MIN_FORM;

  // ── Compute which nodes changed ────────────────────────────────────────────
  const lc = (s: string) => s.toLowerCase();

  const matchesExercise = (n: EvaluatedSkill) =>
    n.exercises.some((e) => lc(e) === lc(exerciseName));

  const prevRelated = prevEvaluated.filter(matchesExercise);
  const nextRelated = nextEvaluated.filter(matchesExercise);

  /** Node that just went unlocked → mastered this session */
  const newlyMasteredNode = nextRelated.find(
    (next) =>
      next.status === "mastered" &&
      prevRelated.find((p) => p.id === next.id)?.status === "unlocked",
  );

  /** Next node that just became available because the above was mastered */
  const newlyUnlockedNode = nextEvaluated.find(
    (next) =>
      next.status === "unlocked" &&
      prevEvaluated.find((p) => p.id === next.id)?.status === "locked",
  );

  /** The "active" skill node being tracked — prefer newly mastered, else lowest unlocked */
  const activeNode =
    newlyMasteredNode ??
    nextRelated.find((n) => n.status === "unlocked") ??
    nextRelated[nextRelated.length - 1];

  const prevActive = activeNode
    ? prevRelated.find((p) => p.id === activeNode.id)
    : undefined;

  const skillUnlocked = !!newlyMasteredNode;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleViewSession = () => navigate(`/session/${sessionId}`);

  const handleContinue = () => {
    if (newlyUnlockedNode) {
      navigate(`/workout?exercise=${encodeURIComponent(newlyUnlockedNode.exercises[0])}`);
    }
    onClose();
  };

  return (
    <>
      {skillUnlocked && <ConfettiCanvas />}

      {/* ── Backdrop ─────────────────────────────────────────────────── */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">

        {/* ── Card ─────────────────────────────────────────────────── */}
        <div
          className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
          style={
            skillUnlocked
              ? { boxShadow: "0 0 60px 0 rgba(234,179,8,0.18)" }
              : undefined
          }
        >
          {/* Header */}
          <div
            className="px-6 pt-6 pb-4 text-center"
            style={
              skillUnlocked
                ? { background: "linear-gradient(to bottom, rgba(120,90,0,0.25), transparent)" }
                : undefined
            }
          >
            <Trophy
              className={`w-8 h-8 mx-auto mb-2 ${skillUnlocked ? "text-yellow-400" : "text-muted-foreground"}`}
            />
            <h2 className="text-xl font-bold">
              {skillUnlocked ? "Skill Unlocked!" : "Set Complete"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {exerciseName} · {isStatic ? formatHold(totalReps) : `${totalReps} rep${totalReps !== 1 ? "s" : ""}`}
            </p>
          </div>

          <div className="px-6 pb-6 space-y-4">

            {/* Form Mastery ring */}
            <div className="text-center">
              <FormRing score={avgFormScore} />
            </div>

            {/* Ghost Sync badge */}
            {bestSyncPct !== undefined && (
              <div className="flex items-center justify-between bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Ghost className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-sm font-semibold text-cyan-300">Best Ghost Sync</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-2xl font-black tabular-nums"
                    style={{
                      color:
                        bestSyncPct >= 90 ? "#86efac" :
                        bestSyncPct >= 75 ? "#fde047" : "#fca5a5",
                    }}
                  >
                    {bestSyncPct}%
                  </span>
                  {bestSyncPct >= 90 && (
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Elite</span>
                  )}
                </div>
              </div>
            )}

            {/* Perfect Set badge */}
            {isPerfectSet && (
              <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
                <Zap className="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-yellow-300">Perfect Set!</p>
                  <p className="text-xs text-yellow-400/70 mt-0.5">
                    {totalReps} reps · {avgFormScore !== null ? Math.round(avgFormScore) : 0}% form — elite execution
                  </p>
                </div>
              </div>
            )}

            {/* Skill Unlocked banner */}
            {skillUnlocked && newlyMasteredNode && (
              <div className="rounded-xl border border-yellow-500/40 px-4 py-3 space-y-1.5"
                style={{ background: "linear-gradient(135deg, rgba(234,179,8,0.15), rgba(245,158,11,0.08))" }}>
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400 shrink-0" />
                  <span className="font-bold text-yellow-200 text-sm leading-tight">
                    {newlyMasteredNode.title} — Mastered
                  </span>
                </div>
                {newlyUnlockedNode && (
                  <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium pl-7">
                    <ChevronRight className="w-3 h-3" />
                    Next: {newlyUnlockedNode.title}
                  </div>
                )}
              </div>
            )}

            {/* Skill progress bar */}
            {activeNode && (
              <div className="bg-secondary/60 rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
                  Skill Progress
                </p>
                <SkillProgressBar
                  node={activeNode}
                  prevQualifying={prevActive?.progress.qualifyingSessions ?? activeNode.progress.qualifyingSessions}
                  nextQualifying={activeNode.progress.qualifyingSessions}
                  newlyMastered={skillUnlocked}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleViewSession}
              >
                View Session
              </Button>
              <Button className="flex-1 font-bold" onClick={handleContinue}>
                {newlyUnlockedNode ? "Train Next →" : "Continue"}
              </Button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
