import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { useListExercises, useListSessions, useCreateSession, useUpdateSession, useCreateRep } from "@workspace/api-client-react";
import { FilesetResolver, PoseLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Activity, Play, Square, FlaskConical, Ghost, Settings2, ChevronDown, Info, Crosshair, Volume2, Zap, Eye, EyeOff, Mic, MicOff, PenLine, ChevronLeft, Plus, Minus, Timer, SkipForward, Layers, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getExerciseConfig, type Phase, type Landmark } from "@/lib/exercise-registry";
import { speak as voiceSpeak, cancelSpeech, setVoiceMuted } from "@/lib/voice-service";
import { getRestDuration, type RestDuration, REST_DURATION_OPTIONS } from "@/lib/workout-settings";
import { getVoiceCues, getCameraFacing, getMirrorVideo } from "@/lib/workout-preferences";
import {
  getPhaseTransitionCue,
  getMilestoneCue,
  toneFromScore,
  DESCEND_PACER_CUES,
  ASCEND_PACER_CUE,
} from "@/lib/coaching-engine";
import { PoseSmoother } from "@/lib/pose-smoother";
import {
  type EquipmentSelection,
  DEFAULT_EQUIPMENT,
  PUSH_GEAR_OPTIONS,
  PULL_GEAR_OPTIONS,
  ADD_ON_OPTIONS,
  isPushExercise,
  isPullExercise,
  getPushDepthThreshold,
  getGhostGripLabel,
  RINGS_STABILITY_BONUS,
  RINGS_JITTER_THRESHOLD,
} from "@/lib/equipment";
import { evaluateSkillTree, ALL_SKILL_NODES, type EvaluatedSkill, type SessionSummary } from "@/lib/skill-tree";
import { SessionResults, type SessionResultsProps } from "@/components/session-results";
import { PovReview }                                from "@/components/pov-review";
import { RepRecorder, type BestRepData, type RepReviewPayload } from "@/lib/rep-recorder";
import {
  getGhostConfig,
  getEquipmentGhostConfig,
  getPhaseConfig,
  computeGhostLandmarks,
  computeAnimatedGhostLandmarks,
  calcSyncPct,
  drawGhostSkeleton,
  type GhostExerciseConfig,
} from "@/lib/ghost-poses";

// ─── Exercise menu ────────────────────────────────────────────────────────────

type BranchKey = "PUSH" | "PULL" | "CORE" | "LEGS";

interface ExerciseEntry {
  dbName: string;
  label: string;
  /** Skill-tree node ID that first introduces this exercise — used for locking. */
  nodeId: string | null;
}

interface ExerciseCategory {
  label: string;
  branch: BranchKey;
  color: string;
  exercises: ExerciseEntry[];
}

const EXERCISE_CATEGORIES: ExerciseCategory[] = [
  // ── PUSH (orange) ─────────────────────────────────────────────────────────
  {
    label: "Push — Main",
    branch: "PUSH",
    color: "#f97316",
    exercises: [
      { dbName: "Push-Up",                label: "Push-Up",                nodeId: "push-1" },
      { dbName: "Diamond Push-Up",        label: "Diamond Push-Up",        nodeId: "push-3" },
      { dbName: "Archer Push-Up",         label: "Archer Push-Up",         nodeId: "push-4" },
      { dbName: "Pseudo Planche Push-Up", label: "Pseudo Planche Push-Up", nodeId: "push-5" },
    ],
  },
  {
    label: "Push — Overhead Path",
    branch: "PUSH",
    color: "#f97316",
    exercises: [
      { dbName: "Pike Push-Up",          label: "Pike Push-Up",           nodeId: "push-oh-1" },
      { dbName: "Elevated Pike Push-Up", label: "Elevated Pike Push-Up",  nodeId: "push-oh-2" },
      { dbName: "Handstand Push-Up",     label: "Handstand Push-Up",      nodeId: "push-oh-3" },
      { dbName: "Handstand",             label: "Handstand",              nodeId: "push-oh-4" },
    ],
  },
  {
    label: "Push — Planche Path",
    branch: "PUSH",
    color: "#f97316",
    exercises: [
      { dbName: "Planche Lean",     label: "Planche Lean",     nodeId: "push-pp-1" },
      { dbName: "Tuck Planche",     label: "Tuck Planche",     nodeId: "push-pp-2" },
      { dbName: "Straddle Planche", label: "Straddle Planche", nodeId: "push-pp-3" },
      { dbName: "Planche",          label: "Full Planche",     nodeId: "push-pp-4" },
    ],
  },
  // ── PULL (blue) ───────────────────────────────────────────────────────────
  {
    label: "Pull — Foundation",
    branch: "PULL",
    color: "#3b82f6",
    exercises: [
      { dbName: "Scapular Shrugs",   label: "Scapular Shrugs",   nodeId: "pull-1" },
      { dbName: "Australian Rows",   label: "Australian Rows",   nodeId: null },
      { dbName: "Negative Pull-Ups", label: "Negative Pull-Ups", nodeId: "pull-3" },
      { dbName: "Pull-Up",           label: "Pull-Up",           nodeId: "pull-1" },
    ],
  },
  {
    label: "Pull — Front Lever Path",
    branch: "PULL",
    color: "#3b82f6",
    exercises: [
      { dbName: "Tuck Front Lever",     label: "Tuck Front Lever",     nodeId: "pull-fl-1" },
      { dbName: "Straddle Front Lever", label: "Straddle Front Lever", nodeId: "pull-fl-2" },
      { dbName: "Full Front Lever",     label: "Full Front Lever",     nodeId: "pull-fl-3" },
    ],
  },
  {
    label: "Pull — Muscle-Up Path",
    branch: "PULL",
    color: "#3b82f6",
    exercises: [
      { dbName: "Chest-to-Bar Pull-Up", label: "Chest-to-Bar Pull-Up", nodeId: "pull-mu-1" },
      { dbName: "Muscle-Up",            label: "Muscle-Up",            nodeId: "pull-mu-2" },
    ],
  },
  {
    label: "Pull — Advanced Moves",
    branch: "PULL",
    color: "#3b82f6",
    exercises: [
      { dbName: "Archer Pull-Up",     label: "Archer Pull-Up",     nodeId: "pull-am-1" },
      { dbName: "Typewriter Pull-Up", label: "Typewriter Pull-Up", nodeId: "pull-am-2" },
    ],
  },
  // ── CORE (purple) ─────────────────────────────────────────────────────────
  {
    label: "Core — Main",
    branch: "CORE",
    color: "#8b5cf6",
    exercises: [
      { dbName: "Plank",     label: "Plank",      nodeId: "core-1" },
      { dbName: "Side Plank", label: "Side Plank", nodeId: "core-2" },
    ],
  },
  {
    label: "Core — Hollow Holds Path",
    branch: "CORE",
    color: "#8b5cf6",
    exercises: [
      { dbName: "Dead Bug",           label: "Dead Bug",            nodeId: "core-hh-1" },
      { dbName: "Superman",           label: "Superman",            nodeId: "core-hh-2" },
      { dbName: "Hollow Body Hold",   label: "Hollow Body Hold",    nodeId: "core-hh-3" },
      { dbName: "Dragon Flag Negative", label: "Dragon Flag Negative", nodeId: "core-hh-4" },
      { dbName: "Dragon Flag",        label: "Dragon Flag",         nodeId: "core-hh-5" },
    ],
  },
  {
    label: "Core — Bar Based Path",
    branch: "CORE",
    color: "#8b5cf6",
    exercises: [
      { dbName: "Active Hang",      label: "Active Hang",       nodeId: "core-bb-1" },
      { dbName: "Hanging Knee Tuck", label: "Hanging Knee Tuck", nodeId: "core-bb-2" },
      { dbName: "Hanging Leg Raise", label: "Hanging Leg Raise", nodeId: "core-bb-3" },
      { dbName: "Toes to Bar",      label: "Toes to Bar",       nodeId: "core-bb-4" },
    ],
  },
  {
    label: "Core — Human Flag Path",
    branch: "CORE",
    color: "#8b5cf6",
    exercises: [
      { dbName: "Windshield Wiper",   label: "Windshield Wipers",  nodeId: "core-hf-1" },
      { dbName: "Tucked Human Flag",  label: "Tucked Human Flag",  nodeId: "core-hf-2" },
      { dbName: "One-Leg Human Flag", label: "One-Leg Human Flag", nodeId: "core-hf-3" },
      { dbName: "Human Flag",         label: "Human Flag",         nodeId: "core-hf-4" },
    ],
  },
  // ── LEGS (green) ──────────────────────────────────────────────────────────
  {
    label: "Legs — Main",
    branch: "LEGS",
    color: "#22c55e",
    exercises: [
      { dbName: "Squat",                label: "Squat",                nodeId: "legs-1" },
      { dbName: "Shrimp Squat",         label: "Shrimp Squat",         nodeId: "legs-3" },
      { dbName: "Bulgarian Split Squat", label: "Bulgarian Split Squat", nodeId: "legs-4" },
      { dbName: "Nordic Curls",         label: "Nordic Curls",         nodeId: null },
    ],
  },
  {
    label: "Legs — L-Sit Path",
    branch: "LEGS",
    color: "#22c55e",
    exercises: [
      { dbName: "Pike Stretch",      label: "Pike Stretch",       nodeId: "legs-ls-1" },
      { dbName: "L-Sit Compression", label: "L-Sit Compression",  nodeId: "legs-ls-2" },
      { dbName: "Tuck L-Sit",        label: "Tuck L-Sit",         nodeId: "legs-ls-3" },
      { dbName: "L-Sit",             label: "L-Sit",              nodeId: "legs-ls-4" },
    ],
  },
  {
    label: "Legs — Pistol Squat Path",
    branch: "LEGS",
    color: "#22c55e",
    exercises: [
      { dbName: "Step-Up",             label: "Step-Up",             nodeId: "legs-ps-1" },
      { dbName: "Assisted Pistol Squat", label: "Assisted Pistol Squat", nodeId: "legs-ps-2" },
      { dbName: "Close-Stance Squat",  label: "Close-Stance Squat",  nodeId: "legs-ps-3" },
      { dbName: "Pistol Squat",        label: "Pistol Squat",        nodeId: "legs-ps-4" },
    ],
  },
];

// ─── Sync thresholds ──────────────────────────────────────────────────────────

const SYNC_GATE = 85;
const SYNC_VOICE_THRESHOLD = 80;
const GHOST_CYCLE_MS = 4000;

/** MediaPipe is queried at this rate; the canvas draws at full 60fps via interpolation. */
const DETECT_INTERVAL_MS = 50; // 20 fps detection

// ─── Focal joints per exercise (Minimalist Mode) ──────────────────────────────
// Indices follow the MediaPipe 33-keypoint model (see exercise-registry LM map).
const FOCAL_JOINTS: Record<string, number[]> = {
  // ── Push ────────────────────────────────────────────────────────────────────
  "Push-Up":                 [11, 13, 15], // L shoulder, L elbow, L wrist
  "Wall Push-Up":            [11, 13, 15],
  "Incline Push-Up":         [11, 13, 15],
  "Knee Push-Up":            [11, 13, 15],
  "Diamond Push-Up":         [11, 13, 15],
  "Archer Push-Up":          [11, 13, 15],
  "Pseudo Planche Push-Up":  [11, 13, 15],
  "Pike Push-Up":            [11, 13, 15],
  "Elevated Pike Push-Up":   [11, 13, 15],
  "Handstand Push-Up":       [11, 13, 15],
  "Handstand":               [11, 13, 15],
  "Planche Lean":            [11, 15, 23], // shoulder, wrist, hip
  "Tuck Planche":            [11, 15, 23],
  "Straddle Planche":        [11, 15, 23],
  "Planche":                 [11, 15, 23],
  "Dip":                     [11, 13, 15],
  // ── Pull ────────────────────────────────────────────────────────────────────
  "Pull-Up":                 [11, 13, 15],
  "Negative Pull-Ups":       [11, 13, 15],
  "Australian Rows":         [11, 13, 15],
  "Scapular Shrugs":         [11, 12, 23], // L shoulder, R shoulder, L hip
  "Muscle-Up":               [11, 13, 15],
  "Explosive Pull-Up":       [11, 13, 15],
  "Chest-to-Bar Pull-Up":    [11, 13, 15],
  "Archer Pull-Up":          [11, 13, 15],
  "Typewriter Pull-Up":      [11, 13, 15],
  "Tuck Front Lever":        [11, 13, 23], // shoulder, elbow, hip
  "Straddle Front Lever":    [11, 13, 23],
  "Full Front Lever":        [11, 13, 23],
  "Ring Support Hold":       [11, 13, 15],
  "Ring Pull-Up":            [11, 13, 15],
  "Ring Muscle-Up":          [11, 13, 15],
  "Ring Dip":                [11, 13, 15],
  "Weighted Pull-Up":        [11, 13, 15],
  "Weighted Muscle-Up":      [11, 13, 15],
  "Weighted Dip":            [11, 13, 15],
  // ── Core ────────────────────────────────────────────────────────────────────
  "Plank":                   [11, 23, 27], // shoulder, hip, ankle
  "Side Plank":              [11, 23, 27],
  "Dead Bug":                [23, 25, 27], // hip, knee, ankle
  "Superman":                [11, 23, 27],
  "Hollow Body Hold":        [11, 23, 27],
  "Dragon Flag Negative":    [11, 23, 27],
  "Dragon Flag":             [11, 23, 25],
  "Active Hang":             [15, 11, 23], // wrist, shoulder, hip
  "Hanging Knee Tuck":       [23, 25, 27],
  "Hanging Leg Raise":       [23, 25, 27],
  "Toes to Bar":             [15, 23, 27],
  "Windshield Wiper":        [23, 27, 28], // hip, L ankle, R ankle
  "Tucked Human Flag":       [11, 23, 25],
  "One-Leg Human Flag":      [11, 23, 27],
  "Human Flag":              [11, 12, 13],
  // ── Legs ────────────────────────────────────────────────────────────────────
  "Squat":                   [23, 25, 27], // hip, knee, ankle
  "Assisted Squat":          [23, 25, 27],
  "Archer Squat":            [23, 25, 27],
  "Pistol Squat":            [23, 25, 27],
  "Shrimp Squat":            [23, 25, 27],
  "Bulgarian Split Squat":   [23, 25, 27],
  "Nordic Curls":            [25, 26, 27], // L knee, R knee, L ankle
  "Pike Stretch":            [23, 25, 27],
  "L-Sit Compression":       [23, 25, 27],
  "Tuck L-Sit":              [15, 23, 27],
  "L-Sit":                   [15, 23, 27],
  "Step-Up":                 [23, 25, 27],
  "Assisted Pistol Squat":   [23, 25, 27],
  "Close-Stance Squat":      [23, 25, 27],
  // ── Other ───────────────────────────────────────────────────────────────────
  "Lunge":                   [23, 25, 27],
  "Burpee":                  [11, 23, 27],
};

// ─── Landmark interpolation helper ────────────────────────────────────────────

/** Linear-interpolate between two landmark arrays (for 60fps smoothness). */
function lerpLandmarks(prev: Landmark[], curr: Landmark[], t: number): Landmark[] {
  if (prev.length !== curr.length) return curr;
  return curr.map((c, i) => {
    const p = prev[i];
    return {
      x:          p.x + (c.x - p.x) * t,
      y:          p.y + (c.y - p.y) * t,
      z:          p.z + (c.z - p.z) * t,
      visibility: c.visibility,
    };
  });
}

// ─── Minimalist-mode canvas renderer ─────────────────────────────────────────

/**
 * Draws glowing circles on the 3 focal joints.
 * Joints that are out of alignment with the ghost pulse red.
 */
function drawMinimalistJoints(
  ctx:            CanvasRenderingContext2D,
  userLms:        Landmark[],
  ghostLms:       Landmark[],
  focalIndices:   number[],
  canvasW:        number,
  canvasH:        number,
  nowMs:          number,
) {
  const baseR = Math.min(canvasW, canvasH) * 0.02; // ~14 px on 720-high canvas

  for (const idx of focalIndices) {
    const lm    = userLms[idx];
    const ghost = ghostLms[idx];
    if (!lm) continue;

    const cx   = lm.x * canvasW;
    const cy   = lm.y * canvasH;
    const dist = ghost ? Math.hypot(lm.x - ghost.x, lm.y - ghost.y) : 0;
    const isOut = dist > 0.05;

    const pulse  = isOut ? 0.7 + 0.3 * Math.abs(Math.sin(nowMs / 180)) : 1;
    const radius = baseR * (isOut ? pulse * 1.15 : 1);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);

    if (isOut) {
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur  = 28 * pulse;
      ctx.fillStyle   = `rgba(239,68,68,${0.45 * pulse})`;
      ctx.strokeStyle = `rgba(239,68,68,${0.9 * pulse})`;
    } else {
      ctx.shadowColor = "#22c55e";
      ctx.shadowBlur  = 20;
      ctx.fillStyle   = "rgba(34,197,94,0.30)";
      ctx.strokeStyle = "#22c55e";
    }

    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }
}

// ─── Calibration ─────────────────────────────────────────────────────────────

type CalibPhase = "idle" | "detecting" | "holding" | "done";

/** Landmark indices used for T-Pose detection and body-scale capture. */
const LM_NOSE    = 0;
const LM_L_SH    = 11;
const LM_R_SH    = 12;
const LM_L_WR    = 15;
const LM_R_WR    = 16;
const LM_L_HI    = 23;
const LM_R_HI    = 24;
const LM_L_AN    = 27;
const LM_R_AN    = 28;

/** Required visibility threshold for calibration landmarks. */
const CALIB_VIS = 0.5;
/** How long the user must hold a stable T-Pose (ms). */
const HOLD_DURATION_MS = 3000;

/**
 * Returns true when the detected landmarks represent a stable T-Pose:
 *  - All key landmarks are visible
 *  - Both wrists are near shoulder height (arms horizontal)
 *  - Wrist-to-wrist span is notably wider than shoulder-to-shoulder span
 *  - Ankles are below hips (standing upright)
 */
function detectTPose(lms: Landmark[]): boolean {
  const L_SH = lms[LM_L_SH];
  const R_SH = lms[LM_R_SH];
  const L_WR = lms[LM_L_WR];
  const R_WR = lms[LM_R_WR];
  const L_HI = lms[LM_L_HI];
  const R_HI = lms[LM_R_HI];
  const L_AN = lms[LM_L_AN];
  const R_AN = lms[LM_R_AN];
  const NOSE = lms[LM_NOSE];

  const keyLms = [L_SH, R_SH, L_WR, R_WR, L_HI, R_HI, L_AN, R_AN, NOSE];
  if (keyLms.some(lm => !lm || (lm.visibility ?? 1) < CALIB_VIS)) return false;

  // Arms must be roughly horizontal: wrist y ≈ shoulder y (within 12% of frame height)
  if (Math.abs(L_WR.y - L_SH.y) > 0.12) return false;
  if (Math.abs(R_WR.y - R_SH.y) > 0.12) return false;

  // Wrists must be spread wider than shoulders (arms fully extended outward)
  const shoulderSpan = Math.abs(R_SH.x - L_SH.x);
  const wristSpan    = Math.abs(R_WR.x - L_WR.x);
  if (wristSpan < shoulderSpan * 1.4) return false;

  // Ankles must be below hips (person is upright, not inverted)
  if (L_AN.y < L_HI.y + 0.05) return false;
  if (R_AN.y < R_HI.y + 0.05) return false;

  return true;
}

// ─── T-Pose silhouette SVG ────────────────────────────────────────────────────

function TPoseSilhouette({ detected }: { detected: boolean }) {
  const color = detected ? "#22c55e" : "rgba(255,255,255,0.35)";
  return (
    <svg
      viewBox="0 0 120 240"
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none"
      style={{ height: "72%", filter: detected ? `drop-shadow(0 0 12px #22c55e)` : undefined }}
      aria-hidden
    >
      {/* Head */}
      <circle cx="60" cy="14" r="12" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      {/* Neck */}
      <line x1="60" y1="26" x2="60" y2="42" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      {/* Shoulders */}
      <line x1="4"  y1="60" x2="116" y2="60" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      {/* Torso */}
      <line x1="60" y1="42" x2="60" y2="136" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      {/* Left upper arm */}
      <line x1="60" y1="60" x2="4"   y2="60" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      {/* Left forearm */}
      <line x1="4"  y1="60" x2="4"   y2="100" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      {/* Right upper arm */}
      <line x1="60" y1="60" x2="116" y2="60" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      {/* Right forearm */}
      <line x1="116" y1="60" x2="116" y2="100" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      {/* Hips */}
      <line x1="40" y1="136" x2="80" y2="136" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      {/* Left leg */}
      <line x1="40" y1="136" x2="30" y2="230" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      {/* Right leg */}
      <line x1="80" y1="136" x2="90" y2="230" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Calibration overlay ──────────────────────────────────────────────────────

interface CalibrationOverlayProps {
  phase: CalibPhase;
  countdown: number;
}

function CalibrationOverlay({ phase, countdown }: CalibrationOverlayProps) {
  const detected = phase === "holding" || phase === "done";

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-between pointer-events-none select-none">

      {/* Top instruction banner */}
      <div className="w-full flex justify-center pt-20">
        <div
          className="px-5 py-3 rounded-2xl text-center max-w-xs backdrop-blur-sm"
          style={{
            background: "rgba(0,0,0,0.65)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <p className="text-sm font-semibold text-white/90 leading-snug">
            Step back and stand in a T-Pose
          </p>
          <p className="text-xs text-white/55 mt-1">
            Ensure your hands and feet are in the frame
          </p>
        </div>
      </div>

      {/* Centre: T-Pose silhouette */}
      <TPoseSilhouette detected={detected} />

      {/* Bottom: status */}
      <div className="w-full flex justify-center pb-28">
        {phase === "idle" || phase === "detecting" ? (
          <div
            className="px-6 py-2.5 rounded-full text-sm font-bold uppercase tracking-widest"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            ○ Waiting for T-Pose…
          </div>
        ) : phase === "holding" ? (
          <div
            className="flex flex-col items-center gap-2"
          >
            <div
              className="px-6 py-2.5 rounded-full text-sm font-bold uppercase tracking-widest"
              style={{
                background: "rgba(34,197,94,0.18)",
                border: "1px solid rgba(34,197,94,0.5)",
                color: "#86efac",
              }}
            >
              ● Holding…
            </div>
            <div
              className="text-7xl font-black tabular-nums leading-none"
              style={{ color: "#22c55e", textShadow: "0 0 24px rgba(34,197,94,0.7)" }}
            >
              {countdown}
            </div>
          </div>
        ) : (
          <div
            className="px-6 py-2.5 rounded-full text-sm font-bold uppercase tracking-widest"
            style={{
              background: "rgba(34,197,94,0.25)",
              border: "1px solid rgba(34,197,94,0.7)",
              color: "#4ade80",
            }}
          >
            ✓ Calibrated!
          </div>
        )}
      </div>

      {/* Corner label */}
      <div
        className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded"
        style={{
          background: "rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.4)",
        }}
      >
        Calibration
      </div>
    </div>
  );
}

// ─── Workout component ────────────────────────────────────────────────────────

export function Workout() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const { data: exercises } = useListExercises();

  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");
  const [sessionResults, setSessionResults] = useState<Omit<SessionResultsProps, "onClose"> | null>(null);
  const [povReview,      setPovReview]      = useState<{ payload: RepReviewPayload; results: Omit<SessionResultsProps, "onClose"> } | null>(null);
  const [pickerOpen,     setPickerOpen]     = useState(false);
  const [infoExercise,   setInfoExercise]   = useState<{ name: string; id: number; nodeId: string | null } | null>(null);

  const { data: sessionHistory } = useListSessions(
    { limit: 500, offset: 0 },
    { query: { queryKey: ["/api/sessions", { limit: 500 }] } },
  );

  const evaluatedSkills = useMemo(() => {
    if (!sessionHistory) return {} as Record<string, EvaluatedSkill>;
    const history: SessionSummary[] = sessionHistory.map(s => ({
      exerciseName: s.exerciseName,
      totalReps: s.totalReps ?? null,
      avgFormScore: s.avgFormScore != null ? Number(s.avgFormScore) : null,
      completedAt: s.completedAt ?? null,
    }));
    const result = evaluateSkillTree(history);
    const map: Record<string, EvaluatedSkill> = {};
    for (const ev of result) map[ev.id] = ev;
    return map;
  }, [sessionHistory]);

  function isExerciseLocked(nodeId: string | null): boolean {
    if (!nodeId) return false;
    const node = ALL_SKILL_NODES.find(n => n.id === nodeId);
    if (!node) return false;
    // Level 1 nodes and nodes with no prerequisite are always unlocked
    if (!node.prerequisiteId || node.level <= 1) return false;
    // Only lock if we actually have session data loaded AND the prereq isn't mastered
    if (!sessionHistory) return false;
    const prereqStatus = evaluatedSkills[node.prerequisiteId]?.status;
    return prereqStatus !== "mastered";
  }

  useEffect(() => {
    if (!exercises || selectedExerciseId) return;
    const params = new URLSearchParams(search);
    const name = params.get("exercise");
    if (!name) return;
    const match = exercises.find(e => e.name.toLowerCase() === name.toLowerCase());
    if (match) setSelectedExerciseId(match.id.toString());
  }, [exercises, search, selectedExerciseId]);

  // ── Workout state ──────────────────────────────────────────────────────────
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [reps, setReps] = useState(0);
  const [holdSeconds, setHoldSeconds] = useState(0);
  const [isInActiveZone, setIsInActiveZone] = useState(false);
  const [formScore, setFormScore] = useState(100);
  const [syncPct, setSyncPct] = useState(100);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isSavingTest, setIsSavingTest] = useState(false);
  const [isManualLog, setIsManualLog] = useState(false);
  const [manualReps, setManualReps] = useState(10);
  const [manualRpe, setManualRpe] = useState<number | null>(null);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [isEnding,       setIsEnding]       = useState(false);

  // ── Multi-set tracking ─────────────────────────────────────────────────────
  const [totalSets,  setTotalSets]  = useState(3);
  const [currentSet, setCurrentSet] = useState(1);
  const [setsLog,    setSetsLog]    = useState<Array<{ reps: number; holdSec: number }>>([]);
  const setStartRepCountRef  = useRef(0);
  const setStartHoldSecRef   = useRef(0);

  // ── Rest timer ─────────────────────────────────────────────────────────────
  const [isResting,   setIsResting]   = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Voice commands ─────────────────────────────────────────────────────────
  const [voiceCommandsEnabled, setVoiceCommandsEnabled] = useState(false);
  const [isListening,          setIsListening]          = useState(false);
  const speechRecognitionRef   = useRef<{ stop: () => void; start: () => void } | null>(null);
  const voiceCommandsEnabledRef = useRef(false);
  /** Mirror of critical boolean states — kept current so the voice onresult
   *  handler (captured in a closure) can read the latest values without
   *  causing the SpeechRecognition effect to restart on every render. */
  const voiceStateRef = useRef({ isResting: false, isWorkoutActive: false, isCalibrating: false });

  // Stable refs to the latest handler versions (avoids stale closures in voice)
  const handleEndSetRef       = useRef<() => Promise<void>>(async () => {});
  const handleStartNextSetRef = useRef<() => void>(() => {});
  const handleStopRef         = useRef<() => Promise<void>>(async () => {});
  const handleStartRef        = useRef<() => Promise<void>>(async () => {});
  /** Guards against double-firing End Workout (button + voice command race). */
  const isEndingRef           = useRef(false);

  // ── Equipment selection ────────────────────────────────────────────────────
  const [equipment, setEquipment] = useState<EquipmentSelection>(DEFAULT_EQUIPMENT);

  // ── Calibration state ──────────────────────────────────────────────────────
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibPhase, setCalibPhase] = useState<CalibPhase>("idle");
  const [calibCountdown, setCalibCountdown] = useState(3);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const landmarkerRef      = useRef<PoseLandmarker | null>(null);
  const requestRef         = useRef<number>(0);
  const calibFrameRef      = useRef<number>(0);
  const lastVideoTimeRef   = useRef<number>(-1);
  const workoutStartMsRef  = useRef<number>(0);

  const stateRef = useRef({
    phase:            "up" as Phase,
    repCount:         0,
    lastSpokenTime:   0,
    lastPhaseCueMs:   0,   // separate cooldown for phase-transition cues (2 s)
    sessionStartTime: 0,
    sessionId:        0,
    repFormScores:    [] as number[],
    lastRepTime:      0,
    avgRepDurationMs: 0,   // rolling average rep duration for milestone detection
    holdSeconds:      0,
    lastHoldTickMs:   0,
    holdActive:       false,
    lastHoldSpeakSec: -1,
    bestSyncPct:      0,
    lastSyncDropMs:   0,
  });

  const calibRef = useRef<{
    holdStartMs: number;
    userScale: { wingspan: number; height: number } | null;
  }>({ holdStartMs: 0, userScale: null });

  /** RepRecorder instance — active for the duration of a workout set. */
  const recorderRef     = useRef<RepRecorder | null>(null);
  /** Tracks the best sync % seen across reps (for deciding when to log a new best rep). */
  const bestRepSyncRef  = useRef<number>(0);

  /** Wrist positions over the last N frames — used for rings jitter detection. */
  const wristHistoryRef = useRef<Array<{ lx: number; ly: number; rx: number; ry: number }>>([]);

  /** Per-frame equipment modifier data shared between predictWebcam and processFrame. */
  const equipModRef = useRef({ wristJitter: 0, wristOverextended: false });

  /** Anti-cheat: true if a frozen/static video frame was detected this session. */
  const frozenDetectedRef = useRef(false);
  /** Anti-cheat: tracks last seen video.currentTime and when it first went static. */
  const frozenCheckRef = useRef({ lastTime: -1, sinceMs: 0 });

  // ── Smoothing + detection-rate control ───────────────────────────────────
  const smootherRef       = useRef(new PoseSmoother());
  /** performance.now() when the last MediaPipe detection ran. */
  const lastDetectMsRef   = useRef(0);
  /** performance.now() of the detection before that (for interpolation). */
  const prevDetectMsRef   = useRef(0);
  /** EMA-smoothed landmarks from the most-recent detection. */
  const currSmoothedRef   = useRef<Landmark[] | null>(null);
  /** EMA-smoothed landmarks from the detection before that. */
  const prevSmoothedRef   = useRef<Landmark[] | null>(null);
  /** Ghost landmarks computed at the last detection. */
  const currGhostRef      = useRef<Landmark[] | null>(null);
  /** Ghost config at the last detection. */
  const currGhostConfigRef = useRef<GhostExerciseConfig | null>(null);
  /** Sync % at the last detection. */
  const currSyncPctRef    = useRef(100);

  // ── Workout Preferences (from localStorage, read once on mount) ───────────
  const [mirrorVideo] = useState(() => getMirrorVideo());

  // Apply / remove the voice-muted flag whenever the component mounts/unmounts
  useEffect(() => {
    setVoiceMuted(!getVoiceCues());
    return () => { setVoiceMuted(false); };
  }, []);

  // ── Minimalist Mode ──────────────────────────────────────────────────────
  const [minimalistMode, setMinimalistModeState] = useState(false);
  const minimalistModeRef = useRef(false);
  const setMinimalistMode = (v: boolean) => {
    minimalistModeRef.current = v;
    setMinimalistModeState(v);
  };

  // ── Voice Pacing ──────────────────────────────────────────────────────────
  // When ON, the AI calls movement transitions in real-time:
  // "Down... 2... 1... and Up!" queued via setTimeout on each phase change.
  const [voicePacing, setVoicePacingState] = useState(false);
  const voicePacingRef = useRef(false);
  const setVoicePacing = (v: boolean) => {
    voicePacingRef.current = v;
    setVoicePacingState(v);
  };
  // Holds setTimeout IDs for pending pacer cues so they can be cancelled
  // when the phase reverses before the sequence completes.
  const pacerTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearPacerTimeouts = () => {
    pacerTimeoutsRef.current.forEach(t => clearTimeout(t));
    pacerTimeoutsRef.current = [];
  };

  const createSession = useCreateSession();
  const updateSession = useUpdateSession();
  const createRep     = useCreateRep();

  // ── Voice helpers ──────────────────────────────────────────────────────────
  /**
   * General coaching cue — 4 s cooldown prevents rapid-fire speech.
   * Accepts an optional tone that adjusts ElevenLabs expressiveness.
   */
  const speak = useCallback((text: string, tone: "encouraging" | "firm" | "neutral" = "neutral") => {
    const now = Date.now();
    if (now - stateRef.current.lastSpokenTime < 4000) return;
    stateRef.current.lastSpokenTime = now;
    voiceSpeak(text, tone);
  }, []);

  /**
   * Phase-transition cue — independent 2 s cooldown so it doesn't block
   * the general coaching cue queue. Pacer cues bypass this entirely.
   */
  const speakPhase = useCallback((text: string, tone: "encouraging" | "firm" | "neutral" = "neutral") => {
    const now = Date.now();
    if (now - stateRef.current.lastPhaseCueMs < 2000) return;
    stateRef.current.lastPhaseCueMs = now;
    voiceSpeak(text, tone);
  }, []);

  const lastSyncVoiceRef = useRef<number>(0);
  const speakSyncDrop = useCallback(() => {
    const now = Date.now();
    if (now - lastSyncVoiceRef.current < 5000) return;
    lastSyncVoiceRef.current = now;
    voiceSpeak("Get back into position to continue.", "neutral");
  }, []);

  // ── Load MediaPipe model ───────────────────────────────────────────────────
  useEffect(() => {
    async function loadModel() {
      setIsModelLoading(true);
      let vision;
      try {
        vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
      } catch {
        setIsModelLoading(false);
        toast({ title: "Pose tracking unavailable", description: "Could not load the vision library. Check your connection.", variant: "destructive" });
        return;
      }

      const modelAssetPath = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

      for (const delegate of ["GPU", "CPU"] as const) {
        try {
          const landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath, delegate },
            runningMode: "VIDEO",
            numPoses: 1,
          });
          landmarkerRef.current = landmarker;
          setIsModelLoading(false);
          return;
        } catch {
          // try next delegate
        }
      }

      setIsModelLoading(false);
      toast({ title: "Pose tracking unavailable", description: "Your device does not support real-time pose detection. Use Test Mode instead." });
    }
    loadModel();
    return () => { landmarkerRef.current?.close(); };
  }, [toast]);

  // ── Mounted guard — prevents async continuations from touching state/DOM
  //    after the component has already unmounted.
  const mountedRef = useRef(true);

  // ── Camera ─────────────────────────────────────────────────────────────────
  /** Idempotent: does nothing if camera is already streaming. */
  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    if (videoRef.current.srcObject) return; // already running
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: getCameraFacing() },
      });
      // Bail out if the component unmounted while getUserMedia was in-flight.
      if (!mountedRef.current || !videoRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      videoRef.current.srcObject = stream;
      // Catch AbortError: play() is interrupted when srcObject is cleared on
      // unmount before the promise resolves — not a real error, safe to ignore.
      videoRef.current.play().catch(() => {});
    } catch {
      if (mountedRef.current) {
        toast({ title: "Camera error", description: "Could not access camera. Check browser permissions.", variant: "destructive" });
      }
    }
  }, [toast]);

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  // ── processFrame ───────────────────────────────────────────────────────────
  const processFrame = useCallback((
    landmarks: Landmark[],
    ghostLandmarks: Landmark[],
    ghostConfig: GhostExerciseConfig | null,
    currentSyncPct: number,
  ) => {
    const exercise = exercises?.find(e => e.id.toString() === selectedExerciseId);
    if (!exercise) return;

    const config = getExerciseConfig(exercise.name);
    if (!config) return;

    // ── Run exercise state machine ─────────────────────────────────────────
    const prevPhase = stateRef.current.phase;
    const result    = config.processFrame(landmarks, prevPhase as Phase, {
      pushDepthThreshold: isPushExercise(exercise.name)
        ? getPushDepthThreshold(equipment.pushGear)
        : undefined,
    });
    stateRef.current.phase = result.newPhase;
    const phaseChanged = result.newPhase !== prevPhase;

    // ── Equipment modifier: rings stability bonus ──────────────────────────
    let equipBonus = 0;
    let equipCue: string | null = null;
    if (isPullExercise(exercise.name) && equipment.pullGear === "gymnastic-rings") {
      const jitter = equipModRef.current.wristJitter;
      if (jitter < RINGS_JITTER_THRESHOLD) {
        equipBonus = RINGS_STABILITY_BONUS;
      } else if (jitter > RINGS_JITTER_THRESHOLD * 2) {
        equipCue = "Steady the rings — control the swing.";
      }
    }
    if (isPushExercise(exercise.name) && equipment.pushGear === "floor" && equipModRef.current.wristOverextended) {
      equipCue = "Neutral wrists — don't let them bend back.";
    }

    const adjustedFormScore = Math.min(100, result.formScore + equipBonus);
    const blendedScore = ghostConfig
      ? Math.round((adjustedFormScore + currentSyncPct) / 2)
      : adjustedFormScore;
    const tone = toneFromScore(blendedScore);

    const synced = currentSyncPct >= SYNC_GATE;
    const now    = Date.now();

    if (!synced) {
      if (stateRef.current.lastSyncDropMs === 0) {
        stateRef.current.lastSyncDropMs = now;
      } else if (now - stateRef.current.lastSyncDropMs > 1500) {
        speakSyncDrop();
      }
    } else {
      stateRef.current.lastSyncDropMs = 0;
    }

    stateRef.current.bestSyncPct = Math.max(stateRef.current.bestSyncPct, currentSyncPct);
    setSyncPct(Math.round(currentSyncPct));

    // ── Phase-transition coaching (fires once per phase change) ────────────
    if (phaseChanged && !config.isStatic) {
      clearPacerTimeouts();

      if (voicePacingRef.current) {
        // ── Active Pacer: "Down... 2... 1... and Up!" ─────────────────────
        const isDescending =
          (result.newPhase === "down") ||
          (result.newPhase === "bottom" && (prevPhase === "up" || prevPhase === "top"));
        const isAscending  =
          (result.newPhase === "up") ||
          (result.newPhase === "top" && (prevPhase === "down" || prevPhase === "bottom"));

        if (isDescending) {
          // Queue the countdown sequence
          DESCEND_PACER_CUES.forEach(cue => {
            const t = setTimeout(() => {
              voiceSpeak(cue.text, cue.tone);
            }, cue.delayMs);
            pacerTimeoutsRef.current.push(t);
          });
        } else if (isAscending) {
          voiceSpeak(ASCEND_PACER_CUE.text, ASCEND_PACER_CUE.tone);
        }
      } else {
        // ── Standard phase-transition cue ─────────────────────────────────
        const phaseCue = getPhaseTransitionCue(exercise.name, prevPhase as Phase, result.newPhase);
        if (phaseCue) {
          speakPhase(phaseCue.text, phaseCue.tone);
        }
      }
    }

    if (config.isStatic) {
      const holdNow = result.isHoldActive === true && synced;

      if (holdNow && stateRef.current.lastHoldTickMs > 0) {
        const delta   = (now - stateRef.current.lastHoldTickMs) / 1000;
        stateRef.current.holdSeconds += delta;
        const totalSec = Math.floor(stateRef.current.holdSeconds);
        setHoldSeconds(totalSec);

        if (
          totalSec > 0 &&
          totalSec % 5 === 0 &&
          totalSec !== stateRef.current.lastHoldSpeakSec
        ) {
          stateRef.current.lastHoldSpeakSec = totalSec;
          speak(`${totalSec} seconds. Stay strong.`, tone);
        }
      }

      if (holdNow && !stateRef.current.holdActive) {
        speak("Perfect sync — hold it.", "encouraging");
      } else if (!holdNow && stateRef.current.holdActive) {
        if (!synced) {
          // sync drop handled above
        } else {
          speak(result.audioCue ?? "Adjust your position.", tone);
        }
      }

      stateRef.current.holdActive     = holdNow;
      stateRef.current.lastHoldTickMs = holdNow ? now : 0;
      setIsInActiveZone(holdNow);

      stateRef.current.repFormScores.push(blendedScore);
      setFormScore(prev => prev * 0.9 + blendedScore * 0.1);
    } else {
      const { repCounted, repQuality, audioCue } = result;

      if (repCounted && synced) {
        const newRepCount = stateRef.current.repCount + 1;
        stateRef.current.repCount  = newRepCount;
        setReps(newRepCount);

        const duration = now - stateRef.current.lastRepTime;

        // ── Update rolling average rep duration ────────────────────────────
        if (stateRef.current.lastRepTime > 0 && duration > 0) {
          stateRef.current.avgRepDurationMs = stateRef.current.avgRepDurationMs === 0
            ? duration
            : Math.round(stateRef.current.avgRepDurationMs * 0.7 + duration * 0.3);
        }
        stateRef.current.lastRepTime = now;
        stateRef.current.repFormScores.push(blendedScore);

        // ── Log best rep for POV review ───────────────────────────────────
        if (currentSyncPct > bestRepSyncRef.current) {
          bestRepSyncRef.current = currentSyncPct;
          const repData: BestRepData = {
            repNumber:     newRepCount,
            syncPct:       Math.round(currentSyncPct),
            formScore:     blendedScore,
            userLandmarks: landmarks.map(l => ({ ...l })),
            ghostLandmarks: ghostLandmarks.map(l => ({ ...l })),
          };
          recorderRef.current?.logBestRep(repData);
        }

        createRep.mutate({
          sessionId: stateRef.current.sessionId,
          data: {
            repNumber:    newRepCount,
            formScore:    blendedScore,
            durationMs:   duration > 0 ? duration : null,
            feedbackGiven: audioCue ?? equipCue ?? null,
          },
        });

        // ── Rep completion cue ─────────────────────────────────────────────
        // Milestone: if this rep took >1.6× the average, the user is fatiguing
        const isFatiguing =
          stateRef.current.avgRepDurationMs > 0 &&
          duration > stateRef.current.avgRepDurationMs * 1.6 &&
          newRepCount >= 3;

        if (repQuality === "incomplete") {
          speak("Incomplete rep — go deeper next time", "firm");
        } else if (isFatiguing) {
          const milestone = getMilestoneCue();
          speak(milestone.text, milestone.tone);
        } else if (newRepCount % 5 === 0) {
          speak(`${newRepCount} reps. Keep it up!`, "encouraging");
        } else {
          speak("Good rep", "neutral");
        }
      } else if (repCounted && !synced) {
        speak("Match the ghost to earn that rep.", "neutral");
      } else if (equipCue) {
        speak(equipCue, tone);
      } else if (audioCue) {
        // Form correction — use blended score tone so voice matches severity
        speak(audioCue, tone);
      }

      setFormScore(prev => prev * 0.9 + blendedScore * 0.1);
    }
  }, [exercises, selectedExerciseId, speak, speakPhase, speakSyncDrop, createRep, equipment, clearPacerTimeouts]);

  // ── Main camera loop ───────────────────────────────────────────────────────
  //
  // Architecture:
  //   • MediaPipe detection runs at max 20 fps (every DETECT_INTERVAL_MS).
  //   • The canvas redraws at full 60 fps using linear interpolation between
  //     the last two EMA-smoothed landmark snapshots.
  //   • Minimalist Mode skips the full skeleton and renders glowing focal-joint
  //     circles instead; misaligned joints pulse red.
  //
  const predictWebcam = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !landmarkerRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    if (!ctx) { requestRef.current = requestAnimationFrame(predictWebcam); return; }

    const now = performance.now();

    // Sync canvas size to video
    if (video.videoWidth > 0) {
      if (canvas.width  !== video.videoWidth)  canvas.width  = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
    }

    // ── Anti-cheat: frozen/static-image detection ─────────────────────────
    // During an active AI session, if video.currentTime stops advancing for
    // more than 3 seconds (e.g. the user is filming a static image / screen),
    // flag the session as unverified and notify the user once.
    if (stateRef.current.sessionId !== 0 && video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
      const vt = video.currentTime;
      if (vt > 0 && vt === frozenCheckRef.current.lastTime) {
        if (frozenCheckRef.current.sinceMs === 0) {
          frozenCheckRef.current.sinceMs = now;
        } else if (!frozenDetectedRef.current && now - frozenCheckRef.current.sinceMs > 3000) {
          frozenDetectedRef.current = true;
          toast({
            title: "⚠️ Static Image Detected",
            description: "Your video appears frozen. This set will be marked as Unverified.",
            variant: "destructive",
          });
        }
      } else {
        frozenCheckRef.current.sinceMs = 0;
        frozenCheckRef.current.lastTime = vt;
      }
    }

    // ── Detection phase (20 fps) ───────────────────────────────────────────
    const sinceLastDetect = now - lastDetectMsRef.current;
    if (
      sinceLastDetect >= DETECT_INTERVAL_MS &&
      video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA &&
      video.videoWidth > 0
    ) {
      let results;
      try {
        results = landmarkerRef.current.detectForVideo(video, now);
      } catch {
        requestRef.current = requestAnimationFrame(predictWebcam);
        return;
      }

      if (results.landmarks?.length > 0) {
        const raw    = results.landmarks[0];

        // Wrist tracking for rings-jitter detection
        const lWrist = raw[15];
        const rWrist = raw[16];
        const lElbow = raw[13];
        if (lWrist && rWrist) {
          wristHistoryRef.current.push({ lx: lWrist.x, ly: lWrist.y, rx: rWrist.x, ry: rWrist.y });
          if (wristHistoryRef.current.length > 12) wristHistoryRef.current.shift();
          const hist = wristHistoryRef.current;
          if (hist.length >= 4) {
            const meanLx = hist.reduce((s, h) => s + h.lx, 0) / hist.length;
            const meanRx = hist.reduce((s, h) => s + h.rx, 0) / hist.length;
            equipModRef.current.wristJitter =
              hist.reduce((s, h) => s + Math.abs(h.lx - meanLx) + Math.abs(h.rx - meanRx), 0)
              / hist.length / 2;
          }
          if (lElbow) {
            equipModRef.current.wristOverextended = (lWrist.z - lElbow.z) > 0.10;
          }
        }

        // EMA smoothing (5-frame window)
        const smoothed = smootherRef.current.smooth(raw);

        // Ghost landmarks
        const exerciseName = exercises?.find(e => e.id.toString() === selectedExerciseId)?.name ?? "";
        const ghostConfig  = exerciseName
          ? getEquipmentGhostConfig(exerciseName, equipment.pushGear, equipment.pullGear)
          : null;
        const currentPhase = stateRef.current.phase;

        let phasedGhost: Landmark[] = smoothed;
        if (ghostConfig) {
          const phaseConfig = getPhaseConfig(ghostConfig, currentPhase);
          phasedGhost       = computeGhostLandmarks(smoothed, phaseConfig.corrections);
        }

        let currentSyncPct = 100;
        if (ghostConfig) {
          const phaseConfig = getPhaseConfig(ghostConfig, currentPhase);
          currentSyncPct    = calcSyncPct(smoothed, phasedGhost, phaseConfig.keyLandmarks);
        }

        // Rotate buffers: prev ← curr ← new
        prevSmoothedRef.current    = currSmoothedRef.current;
        prevDetectMsRef.current    = lastDetectMsRef.current;
        currSmoothedRef.current    = smoothed;
        currGhostRef.current       = phasedGhost;
        currGhostConfigRef.current = ghostConfig;
        currSyncPctRef.current     = currentSyncPct;
        lastDetectMsRef.current    = now;

        // Game logic at detection rate (20 fps is sufficient for rep counting)
        processFrame(smoothed, phasedGhost, ghostConfig, currentSyncPct);
      }
    }

    // ── Drawing phase (60 fps) ─────────────────────────────────────────────
    const curr = currSmoothedRef.current;
    if (curr && canvas.width > 0) {
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Interpolation factor between the two most-recent detection snapshots
      const prev     = prevSmoothedRef.current;
      const interval = Math.max(1, lastDetectMsRef.current - prevDetectMsRef.current);
      const tLerp    = Math.min(1, (now - lastDetectMsRef.current) / interval);
      const display  = prev ? lerpLandmarks(prev, curr, tLerp) : curr;

      const ghostLms    = currGhostRef.current;
      const ghostConfig = currGhostConfigRef.current;
      const syncPctNow  = currSyncPctRef.current;

      // Ghost skeleton
      if (ghostConfig && ghostLms) {
        const elapsed   = Date.now() - workoutStartMsRef.current;
        const cyclePos  = (elapsed % GHOST_CYCLE_MS) / GHOST_CYCLE_MS;
        const tCycle    = Math.sin(cyclePos * Math.PI * 2) * 0.5 + 0.5;
        const animGhost = computeAnimatedGhostLandmarks(display, ghostConfig, tCycle);
        drawGhostSkeleton(ctx, animGhost, canvas.width, canvas.height, syncPctNow);
      }

      // User landmarks — Minimalist Mode or full skeleton
      const exerciseName = exercises?.find(e => e.id.toString() === selectedExerciseId)?.name ?? "";
      const focalIndices = minimalistModeRef.current ? (FOCAL_JOINTS[exerciseName] ?? null) : null;

      if (focalIndices) {
        drawMinimalistJoints(
          ctx, display, ghostLms ?? display,
          focalIndices, canvas.width, canvas.height, now,
        );
      } else {
        const drawingUtils = new DrawingUtils(ctx);
        // Cast to NormalizedLandmark[] — visibility is always present after detection
        const displayNorm = display as Parameters<typeof drawingUtils.drawLandmarks>[0];
        drawingUtils.drawLandmarks(displayNorm, { radius: 3, color: "#00FF00", lineWidth: 2 });
        drawingUtils.drawConnectors(displayNorm, PoseLandmarker.POSE_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
      }

      ctx.restore();
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  }, [exercises, selectedExerciseId, processFrame, equipment]);

  // ── Calibration loop ───────────────────────────────────────────────────────
  const calibrationLoop = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !landmarkerRef.current) {
      calibFrameRef.current = requestAnimationFrame(calibrationLoop);
      return;
    }

    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    if (!ctx) {
      calibFrameRef.current = requestAnimationFrame(calibrationLoop);
      return;
    }

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;

      if (
        video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        calibFrameRef.current = requestAnimationFrame(calibrationLoop);
        return;
      }

      if (canvas.width  !== video.videoWidth)  canvas.width  = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

      let results;
      try {
        results = landmarkerRef.current.detectForVideo(video, performance.now());
      } catch {
        calibFrameRef.current = requestAnimationFrame(calibrationLoop);
        return;
      }

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.landmarks?.length > 0) {
        const lms = results.landmarks[0];

        // Draw user skeleton in green so they can see themselves
        const drawingUtils = new DrawingUtils(ctx);
        drawingUtils.drawLandmarks(lms, { radius: 3, color: "#00FF00", lineWidth: 2 });
        drawingUtils.drawConnectors(lms, PoseLandmarker.POSE_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });

        const inTPose = detectTPose(lms);
        const now = Date.now();

        if (inTPose) {
          if (calibRef.current.holdStartMs === 0) {
            calibRef.current.holdStartMs = now;
          }

          const elapsed   = now - calibRef.current.holdStartMs;
          const remaining = Math.max(0, Math.ceil((HOLD_DURATION_MS - elapsed) / 1000));
          setCalibCountdown(remaining);
          setCalibPhase("holding");

          if (elapsed >= HOLD_DURATION_MS) {
            // ── Capture body scale ──────────────────────────────────────────
            const L_WR = lms[LM_L_WR];
            const R_WR = lms[LM_R_WR];
            const NOSE = lms[LM_NOSE];
            const L_AN = lms[LM_L_AN];
            const R_AN = lms[LM_R_AN];

            const wingspan = Math.hypot(R_WR.x - L_WR.x, R_WR.y - L_WR.y);
            const ankleY   = (L_AN.y + R_AN.y) / 2;
            const height   = Math.abs(ankleY - NOSE.y);
            calibRef.current.userScale = { wingspan, height };

            // ── Transition ──────────────────────────────────────────────────
            setCalibPhase("done");
            setIsCalibrating(false);

            // Play audio cue immediately
            voiceSpeak("Calibration successful. Getting Ghost Mode ready.");

            // After audio has started (~2.2 s), begin the workout
            setTimeout(() => {
              workoutStartMsRef.current = Date.now();
              setIsWorkoutActive(true);
            }, 2200);

            ctx.restore();
            return; // Stop the calibration loop — workout effect takes over
          }
        } else {
          // Lost T-Pose — reset hold timer
          calibRef.current.holdStartMs = 0;
          setCalibPhase("detecting");
          setCalibCountdown(3);
        }
      } else {
        calibRef.current.holdStartMs = 0;
        setCalibPhase("detecting");
        setCalibCountdown(3);
      }

      ctx.restore();
    }

    calibFrameRef.current = requestAnimationFrame(calibrationLoop);
  }, []); // stable — reads all state from refs or setter fns

  // ── Camera on/off: runs whenever calibrating, workout, or resting ───────────
  useEffect(() => {
    const anyActive = isCalibrating || isWorkoutActive || isResting;
    if (anyActive) {
      startCamera();
    }
    if (!anyActive) {
      cancelAnimationFrame(requestRef.current);
      cancelAnimationFrame(calibFrameRef.current);
      stopCamera();
      cancelSpeech();
    }
    return () => {
      if (!isCalibrating && !isWorkoutActive && !isResting) {
        cancelAnimationFrame(requestRef.current);
        cancelAnimationFrame(calibFrameRef.current);
        stopCamera();
        cancelSpeech();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCalibrating, isWorkoutActive, isResting]);

  // ── Calibration loop lifecycle ─────────────────────────────────────────────
  useEffect(() => {
    if (!isCalibrating) {
      cancelAnimationFrame(calibFrameRef.current);
      return;
    }
    // Give camera a frame to initialise before starting detection
    calibFrameRef.current = requestAnimationFrame(calibrationLoop);
    return () => { cancelAnimationFrame(calibFrameRef.current); };
  }, [isCalibrating, calibrationLoop]);

  // ── Workout loop lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isWorkoutActive) {
      cancelAnimationFrame(requestRef.current);
      return;
    }

    // Start canvas recording for POV review on the FIRST set only.
    // Sets 2+ inherit the recorder that was started in handleStart().
    if (!recorderRef.current && videoRef.current && canvasRef.current) {
      const recorder = new RepRecorder();
      if (recorder.isSupported) {
        recorder.attach(videoRef.current, canvasRef.current);
        recorder.start();
        recorderRef.current = recorder;
        bestRepSyncRef.current = 0;
      }
    }

    // Camera is already running (started during calibration)
    requestRef.current = requestAnimationFrame(predictWebcam);
    return () => {
      cancelAnimationFrame(requestRef.current);
      // NOTE: recorder is NOT destroyed here — it persists across sets so the
      // full multi-set session can be reviewed. handleStop() destroys it.
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorkoutActive]);

  // ── Unmount cleanup: destroy recorder and release all media resources ────────
  // This runs unconditionally when the component unmounts — even mid-workout —
  // so camera tracks are always released and the mic is always stopped.
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      recorderRef.current?.destroy();
      recorderRef.current = null;
      cancelAnimationFrame(requestRef.current);
      cancelAnimationFrame(calibFrameRef.current);
      // Null out srcObject first — this causes any pending play() promise to
      // reject with AbortError, which is caught in startCamera's .catch(() => {}).
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
      cancelSpeech();
      voiceCommandsEnabledRef.current = false;
      try { speechRecognitionRef.current?.stop(); } catch {}
      speechRecognitionRef.current = null;
    };
  }, []);

  // ── Start — enters Calibration Phase ──────────────────────────────────────
  const handleStart = async () => {
    if (!selectedExerciseId) {
      toast({ title: "Select an exercise", description: "Pick an exercise before starting." });
      return;
    }
    try {
      const session = await createSession.mutateAsync({
        data: { exerciseId: parseInt(selectedExerciseId) },
      });
      const selectedExercise = exercises?.find(e => e.id.toString() === selectedExerciseId);
      const config = selectedExercise ? getExerciseConfig(selectedExercise.name) : null;

      stateRef.current = {
        phase:            config?.initialPhase ?? "up",
        repCount:         0,
        lastSpokenTime:   Date.now(),
        lastPhaseCueMs:   0,
        sessionStartTime: Date.now(),
        sessionId:        session.id,
        repFormScores:    [],
        lastRepTime:      Date.now(),
        avgRepDurationMs: 0,
        holdSeconds:      0,
        lastHoldTickMs:   0,
        holdActive:       false,
        lastHoldSpeakSec: -1,
        bestSyncPct:      0,
        lastSyncDropMs:   0,
      };

      // Reset frozen-frame detection for new session
      frozenDetectedRef.current = false;
      frozenCheckRef.current = { lastTime: -1, sinceMs: 0 };

      // Clear any pending pacer cues from the previous set
      clearPacerTimeouts();

      // Reset smoothing + interpolation state for the new set
      smootherRef.current.reset();
      currSmoothedRef.current    = null;
      prevSmoothedRef.current    = null;
      currGhostRef.current       = null;
      currGhostConfigRef.current = null;
      lastDetectMsRef.current    = 0;
      prevDetectMsRef.current    = 0;
      currSyncPctRef.current     = 100;

      setReps(0);
      setHoldSeconds(0);
      setIsInActiveZone(false);
      setFormScore(100);
      setSyncPct(100);

      // ── Reset multi-set tracking for the first set ─────────────────────────
      setCurrentSet(1);
      setSetsLog([]);
      setStartRepCountRef.current = 0;
      setStartHoldSecRef.current  = 0;
      setIsResting(false);
      if (restIntervalRef.current) {
        clearInterval(restIntervalRef.current);
        restIntervalRef.current = null;
      }

      // ── Begin calibration ──────────────────────────────────────────────────
      calibRef.current = { holdStartMs: 0, userScale: null };
      setCalibPhase("detecting");
      setCalibCountdown(3);
      setIsCalibrating(true); // triggers camera + calibration loop effects

      // Haptic: set starting
      try { navigator.vibrate(200); } catch {}
    } catch {
      toast({ title: "Error", description: "Could not start session.", variant: "destructive" });
    }
  };

  const handleStop = async () => {
    // Prevent double-fire from simultaneous button click + voice command.
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    setIsEnding(true);

    // Immediately silence TTS and stop the mic so neither stays active
    // during the async save / navigation transition.
    cancelSpeech();
    voiceCommandsEnabledRef.current = false;
    try { speechRecognitionRef.current?.stop(); } catch {}
    speechRecognitionRef.current = null;
    setIsListening(false);

    setIsWorkoutActive(false);
    setIsCalibrating(false);
    voiceSpeak("Workout complete.");

    // Grab and detach the recorder before any awaits so it stops capturing immediately
    const recorder = recorderRef.current;
    recorderRef.current = null;

    if (!stateRef.current.sessionId) {
      recorder?.destroy();
      isEndingRef.current = false;
      setIsEnding(false);
      return;
    }

    const avgScore =
      stateRef.current.repFormScores.length > 0
        ? stateRef.current.repFormScores.reduce((a, b) => a + b, 0) / stateRef.current.repFormScores.length
        : formScore;

    const selectedExercise = exercises?.find(e => e.id.toString() === selectedExerciseId);
    const exerciseConfig   = selectedExercise ? getExerciseConfig(selectedExercise.name) : null;
    const isStatic         = exerciseConfig?.isStatic === true;

    const finalReps      = isStatic ? Math.round(stateRef.current.holdSeconds) : stateRef.current.repCount;
    const finalFormScore = Math.round(avgScore);
    const finalSessionId = stateRef.current.sessionId;
    const bestSync       = Math.round(stateRef.current.bestSyncPct);
    const exerciseName   = selectedExercise?.name ?? "Exercise";

    const history: SessionSummary[] = (sessionHistory ?? []).map(s => ({
      exerciseName: s.exerciseName ?? "",
      totalReps:    s.totalReps    ?? null,
      avgFormScore: s.avgFormScore ?? null,
      completedAt:  s.completedAt  ?? null,
    }));
    const prevEvaluated = evaluateSkillTree(history);

    try {
      // Wait for the DB write to succeed before showing the summary screen.
      await updateSession.mutateAsync({
        id:   finalSessionId,
        data: {
          completedAt:  new Date().toISOString(),
          totalReps:    finalReps,
          avgFormScore: finalFormScore,
          ...(frozenDetectedRef.current ? { isVerified: false } : {}),
        },
      });

      const newSession: SessionSummary = {
        exerciseName,
        totalReps:    finalReps,
        avgFormScore: finalFormScore,
        completedAt:  new Date().toISOString(),
      };
      const nextEvaluated = evaluateSkillTree([...history, newSession]);

      const resultsProps: Omit<SessionResultsProps, "onClose"> = {
        exerciseName,
        totalReps:    finalReps,
        avgFormScore: finalFormScore,
        sessionId:    finalSessionId,
        bestSyncPct:  bestSync,
        prevEvaluated,
        nextEvaluated,
      };

      // ── Try to show POV review first (only for non-static exercises with reps) ──
      if (recorder && !isStatic && finalReps > 0) {
        const reviewPayload = await recorder.stopAsync(exerciseName);
        if (reviewPayload) {
          setPovReview({ payload: reviewPayload, results: resultsProps });
          return; // Session results shown after the user dismisses POV review
        }
      } else {
        recorder?.destroy();
      }

      // No recording available → go straight to session results
      setSessionResults(resultsProps);
    } catch {
      recorder?.destroy();
      toast({ title: "Save error", description: "Failed to save session. Please try again.", variant: "destructive" });
    } finally {
      isEndingRef.current = false;
      setIsEnding(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Utility functions (defined inside component so they use component state/refs)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Plays a short "ding" tone via Web Audio API. */
  function playDing() {
    try {
      const ctx  = new AudioContext();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
      osc.onended = () => void ctx.close();
    } catch { /* AudioContext unavailable */ }
  }

  /** Triggers device haptic feedback (silently ignored if not supported). */
  function triggerHaptic(pattern: number | number[]) {
    try { navigator.vibrate(pattern); } catch { /* not supported */ }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Multi-set: end current set (start rest or finish workout)
  // ─────────────────────────────────────────────────────────────────────────────

  const handleEndSet = async () => {
    if (!isWorkoutActive) return;

    // Haptic: set ended
    triggerHaptic([100, 50, 100]);

    setIsWorkoutActive(false);

    const setRepsThisSet = isStaticExercise
      ? Math.round(stateRef.current.holdSeconds - setStartHoldSecRef.current)
      : stateRef.current.repCount - setStartRepCountRef.current;

    const newSetsLog = [...setsLog, { reps: setRepsThisSet, holdSec: stateRef.current.holdSeconds }];
    setSetsLog(newSetsLog);

    if (currentSet >= totalSets) {
      // Last set — finish the workout
      voiceSpeak(`Set ${currentSet} done. Workout complete!`);
      await handleStop();
    } else {
      // More sets to go — start rest timer
      voiceSpeak(`Set ${currentSet} done. Rest up.`, "encouraging");
      const restDur = getRestDuration();
      setRestSeconds(restDur);
      setIsResting(true);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Multi-set: begin calibration for the next set (no new DB session)
  // ─────────────────────────────────────────────────────────────────────────────

  const handleStartNextSet = () => {
    // Stop rest timer
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
    setIsResting(false);

    const nextSet = currentSet + 1;
    setCurrentSet(nextSet);

    // Record where this set starts in the cumulative counters
    setStartRepCountRef.current = stateRef.current.repCount;
    setStartHoldSecRef.current  = stateRef.current.holdSeconds;

    // Reset per-set perception state (keep sessionId, repCount, repFormScores)
    const exercise = exercises?.find(e => e.id.toString() === selectedExerciseId);
    const config   = exercise ? getExerciseConfig(exercise.name) : null;
    stateRef.current.phase            = config?.initialPhase ?? "up";
    stateRef.current.lastSpokenTime   = Date.now();
    stateRef.current.lastPhaseCueMs   = 0;
    stateRef.current.lastRepTime      = Date.now();
    stateRef.current.avgRepDurationMs = 0;
    stateRef.current.holdActive       = false;
    stateRef.current.lastHoldTickMs   = 0;
    stateRef.current.lastHoldSpeakSec = -1;
    stateRef.current.bestSyncPct      = 0;
    stateRef.current.lastSyncDropMs   = 0;

    frozenDetectedRef.current   = false;
    frozenCheckRef.current      = { lastTime: -1, sinceMs: 0 };
    clearPacerTimeouts();
    smootherRef.current.reset();
    currSmoothedRef.current    = null;
    prevSmoothedRef.current    = null;
    currGhostRef.current       = null;
    currGhostConfigRef.current = null;
    lastDetectMsRef.current    = 0;
    prevDetectMsRef.current    = 0;
    currSyncPctRef.current     = 100;

    setFormScore(100);
    setSyncPct(100);
    setIsInActiveZone(false);

    // Haptic: set starting
    triggerHaptic(200);

    // Re-enter calibration for the next set
    calibRef.current = { holdStartMs: 0, userScale: null };
    setCalibPhase("detecting");
    setCalibCountdown(3);
    setIsCalibrating(true);
  };

  /** Manual Log: saves a user-entered rep count (no camera / AI form scoring). */
  const handleManualLog = async () => {
    if (!selectedExerciseId) {
      toast({ title: "Select an exercise", description: "Pick an exercise first." });
      return;
    }
    setIsSavingManual(true);
    try {
      const session = await createSession.mutateAsync({
        data: { exerciseId: parseInt(selectedExerciseId), logType: "manual" },
      });
      const exercise = exercises?.find(e => e.id.toString() === selectedExerciseId);
      const exerciseName = exercise?.name ?? "Exercise";

      const history: SessionSummary[] = (sessionHistory ?? []).map(s => ({
        exerciseName: s.exerciseName ?? "",
        totalReps:    s.totalReps    ?? null,
        avgFormScore: s.avgFormScore ?? null,
        completedAt:  s.completedAt  ?? null,
      }));
      const prevEvaluated = evaluateSkillTree(history);

      await updateSession.mutateAsync({
        id:   session.id,
        data: {
          completedAt: new Date().toISOString(),
          totalReps:   manualReps,
          rpe:         manualRpe ?? undefined,
          isVerified:  false,
        },
      });

      const newSession: SessionSummary = {
        exerciseName,
        totalReps:    manualReps,
        avgFormScore: null,
        completedAt:  new Date().toISOString(),
      };
      const nextEvaluated = evaluateSkillTree([...history, newSession]);

      setIsManualLog(false);
      setManualReps(10);
      setManualRpe(null);
      setSessionResults({
        exerciseName,
        totalReps:    manualReps,
        avgFormScore: null,
        sessionId:    session.id,
        bestSyncPct:  undefined,
        prevEvaluated,
        nextEvaluated,
      });
    } catch {
      toast({ title: "Error", description: "Could not save workout.", variant: "destructive" });
    } finally {
      setIsSavingManual(false);
    }
  };

  /** Test mode: saves a synthetic workout entry without camera. */
  const handleSaveTestWorkout = async () => {
    if (!selectedExerciseId) {
      toast({ title: "Select an exercise", description: "Pick an exercise first." });
      return;
    }
    setIsSavingTest(true);
    try {
      const session = await createSession.mutateAsync({
        data: { exerciseId: parseInt(selectedExerciseId) },
      });

      const repCount  = 12 + Math.floor(Math.random() * 6);
      const baseScore = 65 + Math.floor(Math.random() * 25);
      const exercise  = exercises?.find(e => e.id.toString() === selectedExerciseId);
      const cues      = exercise?.coachingCues ?? [];

      for (let i = 1; i <= repCount; i++) {
        const score = Math.min(100, baseScore + Math.random() * 10 - 5);
        await createRep.mutateAsync({
          sessionId: session.id,
          data: {
            repNumber:    i,
            formScore:    Math.round(score * 10) / 10,
            durationMs:   1800 + Math.floor(Math.random() * 800),
            feedbackGiven: score < 75 && cues.length ? cues[Math.floor(Math.random() * cues.length)] : null,
          },
        });
      }

      const avgScore       = baseScore + Math.random() * 5;
      const finalFormScore = Math.round(avgScore * 10) / 10;

      const history: SessionSummary[] = (sessionHistory ?? []).map(s => ({
        exerciseName: s.exerciseName ?? "",
        totalReps:    s.totalReps    ?? null,
        avgFormScore: s.avgFormScore ?? null,
        completedAt:  s.completedAt  ?? null,
      }));
      const prevEvaluated = evaluateSkillTree(history);

      await updateSession.mutateAsync({
        id:   session.id,
        data: {
          completedAt:  new Date().toISOString(),
          totalReps:    repCount,
          avgFormScore: finalFormScore,
        },
      });

      const exerciseName = exercise?.name ?? "Exercise";
      const newSession: SessionSummary = {
        exerciseName,
        totalReps:    repCount,
        avgFormScore: finalFormScore,
        completedAt:  new Date().toISOString(),
      };
      const nextEvaluated = evaluateSkillTree([...history, newSession]);

      setSessionResults({
        exerciseName,
        totalReps:    repCount,
        avgFormScore: finalFormScore,
        sessionId:    session.id,
        bestSyncPct:  undefined,
        prevEvaluated,
        nextEvaluated,
      });
    } catch {
      toast({ title: "Error", description: "Could not save test workout.", variant: "destructive" });
    } finally {
      setIsSavingTest(false);
    }
  };

  // ── Keep handler refs current (runs every render — no hooks violation) ────────
  handleEndSetRef.current       = handleEndSet;
  handleStartNextSetRef.current = handleStartNextSet;
  handleStopRef.current         = handleStop;
  handleStartRef.current        = handleStart;

  // ── Sync voiceStateRef so recognition closure reads fresh booleans ──────────
  useEffect(() => {
    voiceStateRef.current = { isResting, isWorkoutActive, isCalibrating };
  }, [isResting, isWorkoutActive, isCalibrating]);

  // ── Rest timer countdown ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isResting) {
      if (restIntervalRef.current) {
        clearInterval(restIntervalRef.current);
        restIntervalRef.current = null;
      }
      return;
    }
    restIntervalRef.current = setInterval(() => {
      setRestSeconds(prev => {
        if (prev <= 1) {
          clearInterval(restIntervalRef.current!);
          restIntervalRef.current = null;
          playDing();
          try { navigator.vibrate([200, 100, 200, 100, 200]); } catch {}
          voiceSpeak("Rest over. Get ready for the next set.");
          handleStartNextSetRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (restIntervalRef.current) {
        clearInterval(restIntervalRef.current);
        restIntervalRef.current = null;
      }
    };
  }, [isResting]);

  // ── Voice command recognition ──────────────────────────────────────────────
  useEffect(() => {
    const cameraOn = isCalibrating || isWorkoutActive || isResting;
    if (!voiceCommandsEnabled || !cameraOn) {
      voiceCommandsEnabledRef.current = false;
      try { speechRecognitionRef.current?.stop(); } catch {}
      speechRecognitionRef.current = null;
      setIsListening(false);
      return;
    }

    const SRCtor = (
      (window as unknown as Record<string, unknown>)["SpeechRecognition"] ??
      (window as unknown as Record<string, unknown>)["webkitSpeechRecognition"]
    ) as (new () => {
      continuous:     boolean;
      interimResults: boolean;
      lang:           string;
      start():  void;
      stop():   void;
      onstart:  (() => void) | null;
      onend:    (() => void) | null;
      onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } }; resultIndex: number }) => void) | null;
      onerror:  (() => void) | null;
    }) | undefined;

    if (!SRCtor) {
      toast({ title: "Voice commands not supported", description: "Try Chrome or Edge for voice control." });
      setVoiceCommandsEnabled(false);
      return;
    }

    const recognition = new SRCtor();
    recognition.continuous     = true;
    recognition.interimResults = false;
    recognition.lang           = "en-US";
    voiceCommandsEnabledRef.current = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onend   = () => {
      setIsListening(false);
      if (voiceCommandsEnabledRef.current) {
        setTimeout(() => { try { recognition.start(); } catch {} }, 300);
      }
    };
    recognition.onerror = () => {};
    recognition.onresult = (e) => {
      const t  = e.results[e.resultIndex][0].transcript.toLowerCase().trim();
      const vs = voiceStateRef.current;
      if (t.includes("start")) {
        if (vs.isResting) handleStartNextSetRef.current();
        else if (!vs.isWorkoutActive && !vs.isCalibrating) void handleStartRef.current();
      } else if (t.includes("end set") || t.includes("finish set") || t.includes("done")) {
        if (vs.isWorkoutActive) void handleEndSetRef.current();
      } else if (t.includes("end workout") || t.includes("stop workout") || t.includes("finish workout")) {
        if (vs.isWorkoutActive || vs.isResting) void handleStopRef.current();
      }
    };

    try { recognition.start(); } catch {}
    speechRecognitionRef.current = recognition;

    return () => {
      voiceCommandsEnabledRef.current = false;
      try { recognition.stop(); } catch {}
      speechRecognitionRef.current = null;
      setIsListening(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceCommandsEnabled, isCalibrating, isWorkoutActive, isResting, toast]);

  // ── Derived flags ──────────────────────────────────────────────────────────
  const selectedExerciseConfig = (() => {
    const exercise = exercises?.find(e => e.id.toString() === selectedExerciseId);
    return exercise ? getExerciseConfig(exercise.name) : null;
  })();
  const isStaticExercise = selectedExerciseConfig?.isStatic === true;

  const hasGhostConfig = (() => {
    const name = exercises?.find(e => e.id.toString() === selectedExerciseId)?.name;
    return name ? getGhostConfig(name) !== null : false;
  })();

  function formatHoldTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}`;
  }

  const syncColor =
    syncPct >= 90 ? { bg: "rgba(34,197,94,0.2)",  border: "rgba(34,197,94,0.5)",  text: "#86efac" } :
    syncPct >= 75 ? { bg: "rgba(234,179,8,0.2)",  border: "rgba(234,179,8,0.5)",  text: "#fde047" } :
                    { bg: "rgba(239,68,68,0.18)",  border: "rgba(239,68,68,0.5)",  text: "#fca5a5" };

  // ── Render ─────────────────────────────────────────────────────────────────

  const cameraActive = isCalibrating || isWorkoutActive || isResting;

  return (
    <div className="bg-black text-white min-h-full">

      {/* ── POV Review — fixed overlay, covers nav bar ──────────────────────── */}
      {povReview && (
        <div className="fixed inset-0 z-[200] bg-black">
          <PovReview
            {...povReview.payload}
            sessionId={povReview.results.sessionId}
            onComplete={() => {
              const results = povReview.results;
              setPovReview(null);
              setSessionResults(results);
            }}
          />
        </div>
      )}

      {/* ── Session Results — fixed overlay, covers nav bar ─────────────────── */}
      {sessionResults && !povReview && (
        <div className="fixed inset-0 z-[200] bg-black">
          <SessionResults
            {...sessionResults}
            onClose={() => setSessionResults(null)}
          />
        </div>
      )}

      {/* ── Exercise Info Modal ─────────────────────────────────────────────── */}
      <Dialog open={!!infoExercise} onOpenChange={(open) => { if (!open) setInfoExercise(null); }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          {infoExercise && (() => {
            const infoEx      = exercises?.find(e => e.name === infoExercise.name);
            const infoConfig  = getExerciseConfig(infoExercise.name);
            const isLocked    = isExerciseLocked(infoExercise.nodeId);
            const infoNode    = infoExercise.nodeId ? ALL_SKILL_NODES.find(n => n.id === infoExercise.nodeId) : null;
            const prereqNode  = infoNode?.prerequisiteId ? ALL_SKILL_NODES.find(n => n.id === infoNode.prerequisiteId) : null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    {isLocked
                      ? <Lock className="w-4 h-4 text-white/40 shrink-0" />
                      : <Activity className="w-4 h-4 text-primary shrink-0" />
                    }
                    {infoExercise.name}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 mt-1">

                  {/* ── Locked banner ─────────────────────────────────────── */}
                  {isLocked && (
                    <div
                      className="rounded-xl border p-4 space-y-3"
                      style={{
                        background: "rgba(239,68,68,0.06)",
                        borderColor: "rgba(239,68,68,0.25)",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-red-400 shrink-0" />
                        <span className="text-sm font-bold text-red-400">Exercise Locked</span>
                      </div>
                      {prereqNode ? (
                        <p className="text-xs text-white/60 leading-relaxed">
                          Complete{" "}
                          <span className="font-semibold text-white/80">
                            Lv.{prereqNode.level} {prereqNode.title}
                          </span>{" "}
                          in the Skill Tree to unlock this exercise.
                        </p>
                      ) : (
                        <p className="text-xs text-white/60 leading-relaxed">
                          Complete the prerequisite skill in the Skill Tree to unlock this exercise.
                        </p>
                      )}
                      <button
                        className="flex items-center gap-2 w-full justify-center px-4 py-2.5 rounded-lg border border-white/15 bg-white/[0.06] text-sm font-semibold text-white/80 hover:bg-white/[0.10] transition-colors"
                        onClick={() => {
                          setInfoExercise(null);
                          setLocation(infoExercise.nodeId
                            ? `/skill-tree?node=${infoExercise.nodeId}`
                            : "/skill-tree"
                          );
                        }}
                      >
                        <Activity className="w-3.5 h-3.5 text-primary" />
                        View in Skill Tree
                      </button>
                    </div>
                  )}

                  {/* ── Target Muscles ────────────────────────────────────── */}
                  {infoEx && infoEx.muscleGroups.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Info className="w-3 h-3" /> Target Muscles
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {infoEx.muscleGroups.map(m => (
                          <span
                            key={m}
                            className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-full font-medium border border-primary/20"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Critical Joints ───────────────────────────────────── */}
                  {infoConfig && infoConfig.criticalJoints.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Crosshair className="w-3 h-3 text-primary" /> Critical Joints
                      </div>
                      <ul className="space-y-2.5">
                        {infoConfig.criticalJoints.map((joint, i) => (
                          <li key={i}>
                            <span className="inline-block text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded font-mono">
                              {joint.label}
                            </span>
                            <p className="text-xs text-muted-foreground mt-1 pl-0.5 leading-relaxed">
                              {joint.description}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ── Train / Locked action button ──────────────────────── */}
                  {isLocked ? (
                    <div
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold text-white/30"
                      style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
                    >
                      <Lock className="w-4 h-4" />
                      Locked — complete prerequisite first
                    </div>
                  ) : (
                    <Button
                      className="w-full font-bold mt-2"
                      onClick={() => {
                        if (infoExercise) setSelectedExerciseId(infoExercise.id.toString());
                        setInfoExercise(null);
                      }}
                    >
                      Train {infoExercise.name}
                    </Button>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          CAMERA MODE — fills the content pane while workout / calibration runs
          absolute inset-0 breaks out of the max-w-6xl wrapper in the layout
          so the camera fills the full scrollable area. The nav bar (z-50) is
          fixed above it, so we push the FINISH button up on mobile.
      ══════════════════════════════════════════════════════════════════════ */}
      {cameraActive && (
        <div className="absolute inset-0 bg-zinc-900 overflow-hidden">
          <video
            ref={videoRef}
            className={`absolute inset-0 w-full h-full object-cover${mirrorVideo ? " -scale-x-100" : ""}`}
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            className={`absolute inset-0 w-full h-full object-cover pointer-events-none${mirrorVideo ? " -scale-x-100" : ""}`}
          />

          {/* Calibration overlay */}
          {isCalibrating && (
            <CalibrationOverlay phase={calibPhase} countdown={calibCountdown} />
          )}

          {/* Border glow */}
          {isWorkoutActive && (
            <div
              className="absolute inset-0 pointer-events-none transition-all duration-300"
              style={{
                boxShadow: isStaticExercise
                  ? (isInActiveZone
                      ? "inset 0 0 0 5px rgba(34,197,94,0.75)"
                      : "inset 0 0 0 5px rgba(239,68,68,0.55)")
                  : (syncPct >= SYNC_GATE
                      ? "inset 0 0 0 4px rgba(0,212,255,0.5)"
                      : "inset 0 0 0 4px rgba(255,160,0,0.4)"),
              }}
            />
          )}

          {/* Set counter badge — top center */}
          {isWorkoutActive && totalSets > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 border border-white/15 backdrop-blur-sm">
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-bold text-white">
                  Set <span className="text-primary">{currentSet}</span>
                  <span className="text-white/35"> / {totalSets}</span>
                </span>
              </div>
            </div>
          )}

          {/* Top-left workout controls */}
          {isWorkoutActive && (
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
              <button
                onClick={() => setMinimalistMode(!minimalistMode)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-semibold transition-all select-none"
                style={{
                  background:  minimalistMode ? "rgba(34,197,94,0.18)" : "rgba(0,0,0,0.50)",
                  borderColor: minimalistMode ? "rgba(34,197,94,0.6)"  : "rgba(255,255,255,0.15)",
                  color:       minimalistMode ? "#86efac"               : "rgba(255,255,255,0.50)",
                }}
              >
                {minimalistMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {minimalistMode ? "Minimalist" : "Full Skeleton"}
              </button>
              <button
                onClick={() => setVoicePacing(!voicePacing)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-semibold transition-all select-none"
                style={{
                  background:  voicePacing ? "rgba(139,92,246,0.20)" : "rgba(0,0,0,0.50)",
                  borderColor: voicePacing ? "rgba(139,92,246,0.60)" : "rgba(255,255,255,0.15)",
                  color:       voicePacing ? "#c4b5fd"               : "rgba(255,255,255,0.50)",
                }}
              >
                {voicePacing ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                Voice Pacing
              </button>
              {/* Listening wave indicator */}
              {voiceCommandsEnabled && isListening && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-semibold select-none animate-pulse"
                  style={{
                    background:  "rgba(34,197,94,0.15)",
                    borderColor: "rgba(34,197,94,0.5)",
                    color:       "#86efac",
                  }}
                >
                  <Mic className="w-3.5 h-3.5" />
                  Listening
                </div>
              )}
            </div>
          )}

          {/* Ghost Mode badge */}
          {isWorkoutActive && hasGhostConfig && (
            <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5 select-none">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 border border-cyan-500/40 text-xs font-semibold text-cyan-300">
                <Ghost className="w-3.5 h-3.5" />
                Ghost Mode
              </div>
              {(() => {
                const ex = exercises?.find(e => e.id.toString() === selectedExerciseId);
                if (!ex) return null;
                const label = getGhostGripLabel(equipment, isPushExercise(ex.name), isPullExercise(ex.name));
                if (!label) return null;
                return (
                  <div className="px-2 py-0.5 rounded text-[9px] font-medium text-white/45 bg-black/50 border border-white/10">
                    {label}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Live HUD — above the FINISH button */}
          {isWorkoutActive && (
            <div className="absolute left-0 right-0 px-8 flex justify-between items-end pointer-events-none"
                 style={{ bottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}>

              {isStaticExercise ? (
                <div className="flex flex-col items-start gap-2">
                  <span className="text-sm font-mono text-white/70 uppercase tracking-widest">Hold Time</span>
                  <span
                    className="text-8xl font-black leading-none tracking-tighter drop-shadow-lg"
                    style={{ color: isInActiveZone ? "#22c55e" : "#ef4444" }}
                  >
                    {formatHoldTime(holdSeconds)}
                  </span>
                  <div
                    className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest"
                    style={{
                      backgroundColor: isInActiveZone ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
                      color:           isInActiveZone ? "#86efac" : "#fca5a5",
                      border: `1px solid ${isInActiveZone ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)"}`,
                    }}
                  >
                    {isInActiveZone ? "● Synced — hold it" : "○ Match ghost position"}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <span className="text-sm font-mono text-white/70 uppercase tracking-widest">Reps</span>
                  <span className="text-8xl font-black text-primary leading-none tracking-tighter drop-shadow-lg">
                    {reps - setStartRepCountRef.current}
                  </span>
                </div>
              )}

              {hasGhostConfig && (
                <div className="flex flex-col items-center gap-1 mb-1">
                  <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">Ghost Sync</span>
                  <div className="text-4xl font-black tabular-nums leading-none" style={{ color: syncColor.text }}>
                    {syncPct}%
                  </div>
                  <div
                    className="mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                    style={{ backgroundColor: syncColor.bg, border: `1px solid ${syncColor.border}`, color: syncColor.text }}
                  >
                    {syncPct >= SYNC_GATE ? "● Locked In" : "○ Adjust"}
                  </div>
                </div>
              )}

              <div className="flex flex-col items-center w-28">
                <span className="text-sm font-mono text-white/70 uppercase tracking-widest mb-2">Form</span>
                <div className="w-full h-28 bg-black/40 rounded-full border border-white/10 relative overflow-hidden flex flex-col justify-end p-1">
                  <div
                    className="w-full rounded-full transition-all duration-200"
                    style={{
                      height: `${formScore}%`,
                      backgroundColor: formScore > 80 ? "hsl(var(--primary))" : formScore > 50 ? "#eab308" : "#ef4444",
                    }}
                  />
                </div>
                <span className="mt-2 font-mono font-bold text-xl">{Math.round(formScore)}</span>
              </div>
            </div>
          )}

          {/* Rest timer overlay */}
          {isResting && (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-center"
              style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(10px)" }}
            >
              <div
                className="flex flex-col items-center gap-5 p-10 rounded-3xl border border-white/10"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
                  boxShadow:  "0 8px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.10)",
                }}
              >
                <div className="flex items-center gap-2 text-white/45 text-xs font-bold uppercase tracking-widest">
                  <Timer className="w-4 h-4" />
                  Rest
                </div>
                <div
                  className="text-9xl font-black tabular-nums leading-none tracking-tighter"
                  style={{ color: restSeconds <= 10 ? "#ef4444" : "#22c55e" }}
                >
                  {restSeconds}
                </div>
                <div className="text-white/35 text-sm font-medium">
                  Next: Set {currentSet + 1} of {totalSets}
                </div>
                <button
                  onClick={handleStartNextSet}
                  className="flex items-center gap-2 px-6 py-3 rounded-full border border-primary/40 bg-primary/10 text-primary text-sm font-bold hover:bg-primary/20 transition-colors"
                >
                  <SkipForward className="w-4 h-4" />
                  Start Now
                </button>
                <button
                  onClick={handleStop}
                  disabled={isEnding}
                  className="text-xs text-white/25 hover:text-white/50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  {isEnding ? "Saving…" : "End Workout"}
                </button>
              </div>
            </div>
          )}

          {/* END SET / FINISH button — raised above nav bar on mobile */}
          {isWorkoutActive && (
            <div
              className="absolute left-0 right-0 flex flex-col items-center gap-2 bg-gradient-to-t from-black to-transparent pt-8 pb-4 md:pb-6"
              style={{ bottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              <Button
                variant="destructive"
                size="lg"
                className="w-56 h-14 text-xl font-bold rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5)]"
                onClick={handleEndSet}
              >
                <Square className="w-6 h-6 mr-2 fill-current" />
                END SET {currentSet}
              </Button>
              {totalSets > 1 && (
                <button
                  className="text-xs text-white/30 hover:text-white/60 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  onClick={handleStop}
                  disabled={isEnding}
                >
                  {isEnding ? "Saving…" : "End Workout Early"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SETUP MODE — standard page view, nav bar always visible
      ══════════════════════════════════════════════════════════════════════ */}
      {!cameraActive && (
        <div className="px-4 py-6 sm:px-6 max-w-xl mx-auto space-y-4">

          {/* ── Page header ─────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight leading-none">Workout</h1>
              <p className="text-xs text-white/40 mt-0.5">AI form coaching with Ghost Mode</p>
            </div>
          </div>

          {/* ── Exercise picker card ─────────────────────────────────────── */}
          <div
            className="rounded-2xl border border-white/10 p-4"
            style={{
              background: "linear-gradient(135deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0.02) 100%)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-2">Exercise</div>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  disabled={isModelLoading}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.09] transition-colors disabled:opacity-40"
                >
                  <span className="flex-1 text-left font-semibold text-sm truncate">
                    {isModelLoading
                      ? "Loading model…"
                      : (() => {
                          for (const cat of EXERCISE_CATEGORIES) {
                            const entry = cat.exercises.find(e => {
                              const dbEx = exercises?.find(ex => ex.name === e.dbName);
                              return dbEx?.id.toString() === selectedExerciseId;
                            });
                            if (entry) return entry.label;
                          }
                          return "Select an exercise…";
                        })()}
                  </span>
                  <ChevronDown className="w-4 h-4 shrink-0 text-white/35" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 max-h-[440px] overflow-y-auto" align="start">
                {(() => {
                  const grouped = new Map<BranchKey, typeof EXERCISE_CATEGORIES>();
                  for (const cat of EXERCISE_CATEGORIES) {
                    if (!grouped.has(cat.branch)) grouped.set(cat.branch, []);
                    grouped.get(cat.branch)!.push(cat);
                  }
                  const branchOrder: BranchKey[] = ["PUSH", "PULL", "CORE", "LEGS"];
                  return branchOrder.map(branch => {
                    const cats = grouped.get(branch);
                    if (!cats) return null;
                    const branchColor = cats[0].color;
                    return (
                      <div key={branch}>
                        {/* Branch header */}
                        <div
                          className="px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] sticky top-0 z-10 border-b"
                          style={{
                            background: `${branchColor}22`,
                            borderColor: `${branchColor}44`,
                            color: branchColor,
                          }}
                        >
                          {branch}
                        </div>
                        {cats.map(cat => {
                          const items = cat.exercises
                            .map(entry => {
                              const dbEx = exercises?.find(e => e.name === entry.dbName);
                              return dbEx ? { ...entry, id: dbEx.id } : null;
                            })
                            .filter(Boolean) as Array<ExerciseEntry & { id: number }>;
                          if (items.length === 0) return null;
                          return (
                            <div key={cat.label}>
                              {/* Sub-category header */}
                              <div
                                className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border-b"
                                style={{
                                  color: `${branchColor}99`,
                                  borderColor: "rgba(255,255,255,0.06)",
                                  background: "rgba(255,255,255,0.025)",
                                }}
                              >
                                {cat.label.replace(`${branch.charAt(0)}${branch.slice(1).toLowerCase()} — `, "").replace(/^Push — |^Pull — |^Core — |^Legs — /i, "")}
                              </div>
                              {items.map(item => {
                                const locked = isExerciseLocked(item.nodeId);
                                const isSelected = item.id.toString() === selectedExerciseId;
                                return (
                                  <div
                                    key={item.id}
                                    className={`flex items-center gap-1 border-b border-border/30 group transition-colors ${
                                      isSelected ? "" : locked ? "opacity-50 hover:opacity-70" : "hover:bg-white/[0.04]"
                                    }`}
                                    style={isSelected ? { background: `${branchColor}20` } : undefined}
                                  >
                                    <button
                                      className="flex-1 text-left text-sm px-3 py-2.5 truncate flex items-center gap-2 cursor-pointer"
                                      style={isSelected ? { color: branchColor, fontWeight: 600 } : undefined}
                                      onClick={() => {
                                        if (locked) {
                                          setPickerOpen(false);
                                          setInfoExercise({ name: item.dbName, id: item.id, nodeId: item.nodeId });
                                        } else {
                                          setSelectedExerciseId(item.id.toString());
                                          setPickerOpen(false);
                                        }
                                      }}
                                    >
                                      {locked && <Lock className="w-3 h-3 shrink-0 text-white/30" />}
                                      <span className="truncate">{item.label}</span>
                                    </button>
                                    <button
                                      className="p-2 mr-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all shrink-0"
                                      onClick={(e) => { e.stopPropagation(); setInfoExercise({ name: item.dbName, id: item.id, nodeId: item.nodeId }); }}
                                      title={locked ? "View requirements" : "View coaching info"}
                                    >
                                      {locked ? <Lock className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  });
                })()}
              </PopoverContent>
            </Popover>
          </div>

          {/* ── Sets & Voice card ────────────────────────────────────────── */}
          <div
            className="rounded-2xl border border-white/10 p-4 space-y-4"
            style={{
              background: "linear-gradient(135deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0.02) 100%)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            {/* Sets picker */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-2.5 flex items-center gap-1.5">
                <Layers className="w-3 h-3" />
                Sets
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setTotalSets(n)}
                    className={[
                      "flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all",
                      totalSets === n
                        ? "bg-primary/20 border-primary/60 text-primary shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                        : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/70",
                    ].join(" ")}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice commands toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white/80 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-primary/70" />
                  Voice Commands
                </div>
                <div className="text-[11px] text-white/30 mt-0.5">
                  "start" · "end set" · "end workout"
                </div>
              </div>
              <button
                onClick={() => setVoiceCommandsEnabled(!voiceCommandsEnabled)}
                className={[
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                  voiceCommandsEnabled ? "bg-primary" : "bg-white/10",
                ].join(" ")}
                role="switch"
                aria-checked={voiceCommandsEnabled}
              >
                <span
                  className={[
                    "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition duration-200",
                    voiceCommandsEnabled ? "translate-x-5" : "translate-x-0",
                  ].join(" ")}
                />
              </button>
            </div>
          </div>

          {/* ── Manual Log view ──────────────────────────────────────────── */}
          {isManualLog ? (
            <div
              className="rounded-2xl border border-white/10 p-5 space-y-5"
              style={{
                background: "linear-gradient(135deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.02) 100%)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setIsManualLog(false); setManualReps(10); setManualRpe(null); }}
                  className="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-lg font-bold leading-tight">Manual Log</h2>
                  <p className="text-xs text-white/40">
                    {exercises?.find(e => e.id.toString() === selectedExerciseId)?.name ?? "Select exercise above"}
                  </p>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">Reps Completed</div>
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={() => setManualReps(r => Math.max(0, r - 1))}
                    className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center transition-all active:scale-95"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <div className="text-6xl font-black font-mono text-primary w-24 text-center tabular-nums">
                    {manualReps}
                  </div>
                  <button
                    onClick={() => setManualReps(r => r + 1)}
                    className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center transition-all active:scale-95"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 flex justify-between">
                  <span>RPE — How Hard Was It?</span>
                  {manualRpe && <span className="text-primary">{manualRpe}/10</span>}
                </div>
                <div className="flex gap-1.5 justify-center flex-wrap">
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button
                      key={n}
                      onClick={() => setManualRpe(prev => prev === n ? null : n)}
                      className={`w-9 h-9 rounded-full text-sm font-bold transition-all active:scale-95 ${
                        manualRpe === n
                          ? "bg-primary text-black border-2 border-primary"
                          : "bg-white/8 border border-white/15 text-white/60 hover:border-white/35"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-white/25 mt-2 text-center">
                  1 = very easy · 10 = all-out effort · optional
                </p>
              </div>

              <Button
                size="lg"
                className="w-full h-12 text-base font-bold rounded-xl"
                onClick={handleManualLog}
                disabled={!selectedExerciseId || isSavingManual}
              >
                <PenLine className="w-4 h-4 mr-2" />
                {isSavingManual ? "Saving…" : "Log It"}
              </Button>
            </div>

          ) : (
            /* ── Ready to Train card ─────────────────────────────────────── */
            <div
              className="rounded-2xl border border-white/10 p-5 space-y-5"
              style={{
                background: "linear-gradient(135deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.02) 100%)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              <div>
                <h2 className="text-lg font-bold mb-1">Ready to train?</h2>
                <p className="text-sm text-white/45 leading-snug">
                  A Ghost Skeleton shows perfect form — sync your body with it to earn reps and hold time.
                </p>
              </div>

              {/* Gear Check */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/35">
                  <Settings2 className="w-3 h-3" />
                  Gear Check
                </div>
                <div className="space-y-2">
                  {([
                    { label: "Push",   options: PUSH_GEAR_OPTIONS  as Array<{ value: string; label: string }>, current: equipment.pushGear, onChange: (v: string) => setEquipment(e => ({ ...e, pushGear: v as EquipmentSelection["pushGear"] })) },
                    { label: "Pull",   options: PULL_GEAR_OPTIONS  as Array<{ value: string; label: string }>, current: equipment.pullGear, onChange: (v: string) => setEquipment(e => ({ ...e, pullGear: v as EquipmentSelection["pullGear"] })) },
                    { label: "Add-on", options: ADD_ON_OPTIONS     as Array<{ value: string; label: string }>, current: equipment.addOn,    onChange: (v: string) => setEquipment(e => ({ ...e, addOn:    v as EquipmentSelection["addOn"]    })) },
                  ]).map(row => (
                    <div key={row.label} className="flex items-start gap-3">
                      <span className="text-[10px] text-white/30 uppercase tracking-wider w-12 pt-1.5 shrink-0 text-right">
                        {row.label}
                      </span>
                      <div className="flex gap-1.5 flex-wrap">
                        {row.options.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => row.onChange(opt.value)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${
                              row.current === opt.value
                                ? "bg-primary/20 border-primary/60 text-primary"
                                : "bg-white/5 border-white/15 text-white/55 hover:border-white/35"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pro Tip */}
              {(() => {
                const ex = exercises?.find(e => e.id.toString() === selectedExerciseId);
                if (!ex) return null;
                const config = getExerciseConfig(ex.name);
                const tip = ex.coachingCues?.[0] ?? config?.criticalJoints?.[0]?.description;
                if (!tip) return null;
                return (
                  <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-primary/10 border border-primary/25">
                    <Zap className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-primary/60 mb-0.5">Pro Tip</div>
                      <p className="text-xs text-white/70 leading-snug">{tip}</p>
                    </div>
                  </div>
                );
              })()}

              {/* START */}
              <Button
                size="lg"
                className="w-full h-13 text-lg rounded-xl font-bold"
                onClick={handleStart}
                disabled={!selectedExerciseId || isModelLoading}
              >
                <Play className="w-5 h-5 mr-2 fill-current" />
                {isModelLoading ? "Loading…" : "START"}
              </Button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs text-white/30 uppercase tracking-widest">
                  <span className="bg-transparent px-3">or</span>
                </div>
              </div>

              {/* Manual Log */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 hover:border-amber-400/50 transition-all rounded-xl"
                onClick={() => { setIsManualLog(true); setManualReps(10); setManualRpe(null); }}
                disabled={!selectedExerciseId}
              >
                <PenLine className="w-4 h-4 mr-2" />
                Manual Log (No AI)
              </Button>
            </div>
          )}

          {/* ── Test Mode card ───────────────────────────────────────────── */}
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-4 space-y-3">
              <div className="text-sm text-white/70 font-medium flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-primary" />
                Complete Workout (Test Mode)
              </div>
              <p className="text-xs text-white/40">
                Saves a synthetic workout entry directly to the database — no camera needed.
                Use this to populate charts and history.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full border-white/20 text-white hover:bg-white/10"
                onClick={handleSaveTestWorkout}
                disabled={!selectedExerciseId || isSavingTest}
              >
                {isSavingTest ? "Saving..." : "Save Test Workout"}
              </Button>
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  );
}

// Suppress unused import warning — EvaluatedSkill is re-exported via SessionResultsProps types
void (undefined as unknown as EvaluatedSkill);
void (undefined as unknown as typeof SYNC_VOICE_THRESHOLD);
