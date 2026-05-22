import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { EmojiIcon } from "@/components/emoji-icon";
import { createPortal } from "react-dom";
import { useLocation, useSearch } from "wouter";
import { useListExercises, useListSessions, useCreateSession, useUpdateSession, useCreateRep, useGetCalibration, getListSessionsQueryKey, getGetRecentSessionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { FilesetResolver, PoseLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Activity, Play, Square, Ghost, Settings2, ChevronDown, ChevronRight, Info, Crosshair, Zap, Eye, EyeOff, Mic, MicOff, PenLine, ChevronLeft, Plus, Minus, Timer, SkipForward, Layers, Lock, Ruler, Search, Dumbbell, Crown, Sparkles, Clock, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMyProfile } from "@/lib/social";
import { useBadgeCelebrationTrigger } from "@/components/badge-celebration-context";
import { useSkillMasteryCelebrationTrigger, type SkillMasteryCelebration } from "@/components/skill-mastery-context";
import { MILESTONE_BADGE_MAP } from "@/lib/milestone-badges";
import { getExerciseConfig, getRequiredLandmarks, type Phase, type Landmark, type EquipmentContext } from "@/lib/exercise-registry";
import { getWarmupSuggestionsFor, formatTime, buildWarmupSequence, type Stretch } from "@/lib/mobility-service";
import { WarmupSequencePlayer } from "@/components/warmup-sequence-player";
import { ExerciseAnimation } from "@/components/exercise-animation";
import { speak as voiceSpeak, speakCue as voiceSpeakCue, clearCueCache, cancelSpeech, setVoiceMuted, setVoiceLanguage, setActiveVoiceProfile, getAudioContext, CUE_PRIORITY } from "@/lib/voice-service";
import { getWorkoutPhrase } from "@/lib/cue-translations";
import { useTranslation } from "react-i18next";
import { getRestDuration, type RestDuration, REST_DURATION_OPTIONS } from "@/lib/workout-settings";
import { getVoiceCues, getCameraFacing, getMirrorVideo, getVoiceProfile, getFlavorMode } from "@/lib/workout-preferences";
import {
  getPhaseTransitionCue,
  getMilestoneCue,
  getMotivationalCue,
  getFlavorCue,
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
import { AnalyzingOverlay }                         from "@/components/analyzing-overlay";
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
    label: "Push — Foundation",
    branch: "PUSH",
    color: "#f97316",
    exercises: [
      { dbName: "Wall Push-Up",    label: "Wall Push-Up",    nodeId: "push-f1" },
      { dbName: "Incline Push-Up", label: "Incline Push-Up", nodeId: "push-f1" },
      { dbName: "Knee Push-Up",    label: "Knee Push-Up",    nodeId: "push-f1" },
    ],
  },
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
      { dbName: "Australian Rows",   label: "Australian Rows",   nodeId: "pull-f1" },
      { dbName: "Assisted Dead Hang", label: "Assisted Dead Hang", nodeId: "pull-f1" },
    ],
  },
  {
    label: "Pull — Main",
    branch: "PULL",
    color: "#3b82f6",
    exercises: [
      { dbName: "Scapular Shrugs",   label: "Scapular Shrugs",   nodeId: "pull-1" },
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
    label: "Core — Foundation",
    branch: "CORE",
    color: "#8b5cf6",
    exercises: [
      { dbName: "Knee Plank", label: "Knee Plank", nodeId: "core-f1" },
      { dbName: "Dead Bug",   label: "Dead Bug",   nodeId: "core-f1" },
    ],
  },
  {
    label: "Core — Main",
    branch: "CORE",
    color: "#8b5cf6",
    exercises: [
      { dbName: "Plank",      label: "Plank",      nodeId: "core-1" },
      { dbName: "Side Plank", label: "Side Plank", nodeId: "core-2" },
    ],
  },
  {
    label: "Core — Hollow Holds Path",
    branch: "CORE",
    color: "#8b5cf6",
    exercises: [
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
    label: "Legs — Foundation",
    branch: "LEGS",
    color: "#22c55e",
    exercises: [
      { dbName: "Box Squat", label: "Box Squat", nodeId: "legs-f1" },
    ],
  },
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

// ─── Equipment Specialty categories (Bar / Rings / Weighted) ─────────────────

type EquipmentBranchKey = "BAR" | "RINGS" | "WEIGHTED";

interface EquipmentExerciseCategory {
  label:    string;
  branch:   EquipmentBranchKey;
  color:    string;
  exercises: Array<{ dbName: string; label: string; nodeId: string | null }>;
}

const EQUIPMENT_SPECIALTY_CATEGORIES: EquipmentExerciseCategory[] = [
  // ── Bar Specialist ──────────────────────────────────────────────────────────
  {
    label:  "Bar Specialist",
    branch: "BAR",
    color:  "#f59e0b",
    exercises: [
      { dbName: "Pull-Up",           label: "Bar Volume Pull-Up",    nodeId: "pull-bar-1" },
      { dbName: "Explosive Pull-Up", label: "Explosive Bar Pull-Up", nodeId: "pull-bar-2" },
      { dbName: "Muscle-Up",         label: "Strict Bar Muscle-Up",  nodeId: "pull-bar-3" },
    ],
  },
  // ── Rings ────────────────────────────────────────────────────────────────
  {
    label:  "Rings — Pull",
    branch: "RINGS",
    color:  "#06b6d4",
    exercises: [
      { dbName: "Ring Support Hold", label: "Ring Support Hold", nodeId: "pull-rings-1" },
      { dbName: "Ring Pull-Up",      label: "Ring Pull-Up",      nodeId: "pull-rings-2" },
      { dbName: "Ring Muscle-Up",    label: "Ring Muscle-Up",    nodeId: "pull-rings-3" },
    ],
  },
  {
    label:  "Rings — Push",
    branch: "RINGS",
    color:  "#06b6d4",
    exercises: [
      { dbName: "Ring Dip",       label: "Ring Dip",        nodeId: "push-rings-1" },
      { dbName: "Ring Muscle-Up", label: "Ring Muscle-Up",  nodeId: "push-rings-2" },
    ],
  },
  // ── Weighted ─────────────────────────────────────────────────────────────
  {
    label:  "Weighted — Pull",
    branch: "WEIGHTED",
    color:  "#a855f7",
    exercises: [
      { dbName: "Weighted Pull-Up",   label: "Weighted Pull-Up",   nodeId: "pull-weighted-1" },
      { dbName: "Weighted Pull-Up",   label: "Weighted Volume",    nodeId: "pull-weighted-2" },
      { dbName: "Weighted Muscle-Up", label: "Weighted Muscle-Up", nodeId: "pull-weighted-3" },
    ],
  },
  {
    label:  "Weighted — Push",
    branch: "WEIGHTED",
    color:  "#a855f7",
    exercises: [
      { dbName: "Weighted Dip", label: "Weighted Dip", nodeId: "push-weighted-1" },
    ],
  },
];

// ─── Sync thresholds ──────────────────────────────────────────────────────────

const SYNC_GATE = 85;
const SYNC_VOICE_THRESHOLD = 80;
const GHOST_CYCLE_MS = 4000;

/** MediaPipe is queried at this rate; the canvas draws at full 60fps via interpolation. */
const DETECT_INTERVAL_MS = 33; // ~30 fps detection

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


// ─── Worker types (mirror pose-processor.worker.ts) ──────────────────────────

interface WorkerOutputLocal {
  repCounted:       boolean;
  repQuality:       "complete" | "incomplete" | null;
  newPhase:         Phase;
  formScore:        number;
  audioCue:         string | null;
  isHoldActive?:    boolean;
  isStatic:         boolean;
  /** Primary joint angle this frame — passed back next call as prevKeyAngle. */
  keyAngle:         number | null;
  velocityAssisted: boolean;
}

interface PendingFrameData {
  landmarks:      Landmark[];
  ghostLandmarks: Landmark[];
  ghostConfig:    import("@/lib/ghost-poses").GhostExerciseConfig | null;
  syncPct:        number;
  exerciseId:     string;
  exerciseName:   string;
  prevPhase:      Phase;
}

// ─── Contextual Warmup Modal (Training-tab) ───────────────────────────────────

function WorkoutWarmupModal({
  stretches,
  onClose,
}: {
  stretches: Stretch[];
  onClose: () => void;
}) {
  const [playerActive, setPlayerActive] = useState(false);
  const totalSeconds = stretches.reduce((s, x) => s + x.durationSeconds, 0);
  const mins = Math.ceil(totalSeconds / 60);

  if (playerActive) {
    return (
      <WarmupSequencePlayer
        stretches={stretches}
        onComplete={onClose}
        onExit={() => setPlayerActive(false)}
      />
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative z-10 bg-white w-full sm:max-w-md mx-auto rounded-t-3xl sm:rounded-3xl max-h-[88vh] flex flex-col"
        style={{ border: "1px solid rgba(0,0,0,0.10)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 shrink-0">
          <div>
            <h2 className="text-base font-black text-black">Targeted Warmup</h2>
            <p className="text-xs text-black/45 flex items-center gap-1 mt-0.5">
              <Timer className="w-3 h-3" />
              {stretches.length} exercises · ~{mins} min
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/6 transition-colors"
          >
            <X className="w-4 h-4 text-black/50" />
          </button>
        </div>

        {/* Exercise list */}
        <div className="overflow-y-auto flex-1 divide-y divide-black/8">
          {stretches.map((stretch, i) => (
            <div key={stretch.id} className="px-6 py-4 flex gap-4">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 mt-0.5"
                style={{ background: "#177548" }}
              >
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-bold text-black">{stretch.name}</span>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(23,117,72,0.08)", color: "#177548" }}
                  >
                    {stretch.durationSeconds}s
                  </span>
                </div>
                <p className="text-xs text-black/55 leading-snug mb-1.5">{stretch.description}</p>
                <p className="text-[11px] font-semibold leading-snug flex items-center gap-1" style={{ color: "#177548" }}>
                  <EmojiIcon emoji="💡" className="w-3.5 h-3.5 object-contain shrink-0" style={{ filter: "invert(37%) sepia(51%) saturate(1260%) hue-rotate(101deg) brightness(95%) contrast(96%)" }} />
                  {stretch.coachingCue}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTAs */}
        <div className="px-6 py-4 border-t border-black/10 space-y-2 shrink-0">
          <button
            onClick={() => setPlayerActive(true)}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-black text-white transition-all hover:opacity-90"
            style={{ background: "#177548" }}
          >
            <Play className="w-4 h-4 fill-current" />
            Begin Warmup
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-black/55 hover:bg-black/4 transition-colors border border-black/12"
          >
            Continue to Workout Instead
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Workout component ────────────────────────────────────────────────────────

export function Workout() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const { triggerBadgeCelebrations } = useBadgeCelebrationTrigger();
  const { triggerSkillMasteryCelebrations } = useSkillMasteryCelebrationTrigger();
  const { data: profile } = useMyProfile();
  const isPro = profile?.isPro ?? false;
  const { data: exercises } = useListExercises();
  // Keep Web Speech API locale in sync with the app's chosen language
  const { i18n, t } = useTranslation();
  useEffect(() => {
    setVoiceLanguage(i18n.language);
  }, [i18n.language]);

  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");
  const [warmupExerciseName, setWarmupExerciseName] = useState<string | null>(null);
  const [sessionResults, setSessionResults] = useState<Omit<SessionResultsProps, "onClose"> | null>(null);
  const [povReview,      setPovReview]      = useState<{ payload: RepReviewPayload; results: Omit<SessionResultsProps, "onClose"> } | null>(null);
  const [infoExercise,   setInfoExercise]   = useState<{ name: string; id: number; nodeId: string | null } | null>(null);
  // Combobox state — each column has its own input value + open flag
  const [bwInputVal, setBwInputVal] = useState("");
  const [bwOpen,     setBwOpen]     = useState(false);
  const [eqInputVal, setEqInputVal] = useState("");
  const [eqOpen,     setEqOpen]     = useState(false);
  const bwInputRef = useRef<HTMLInputElement>(null);
  const eqInputRef = useRef<HTMLInputElement>(null);
  // Equipment Lens — synced with Skill Tree page via localStorage
  const [equipmentLensOn, setEquipmentLensOn] = useState<boolean>(() => {
    try { return localStorage.getItem("calicoach_equipment_lens") === "true"; } catch { return false; }
  });
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "calicoach_equipment_lens") {
        setEquipmentLensOn(e.newValue === "true");
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

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

  // Keep activeExerciseNameRef current so speakFormCue can read it in closures.
  useEffect(() => {
    const ex = exercises?.find(e => e.id.toString() === selectedExerciseId);
    activeExerciseNameRef.current = ex?.name ?? "";
  }, [exercises, selectedExerciseId]);

  // Sync voiceProfileIdRef with localStorage so it reflects profile changes
  // made in Settings without requiring a page reload.
  // Also push the active profile into the voice-service module so that
  // all speak() calls (not just speakCue) route through the right ElevenLabs voice.
  useEffect(() => {
    const profileId = getVoiceProfile();
    voiceProfileIdRef.current = profileId;
    setActiveVoiceProfile(profileId);
  });

  // ── Workout state ──────────────────────────────────────────────────────────
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [reps, setReps] = useState(0);
  const [holdSeconds, setHoldSeconds] = useState(0);
  const [isInActiveZone, setIsInActiveZone] = useState(false);
  const [formScore, setFormScore] = useState(100);
  const [syncPct, setSyncPct] = useState(100);
  /** true while all required landmarks for the current exercise are visible */
  const [bodyVisible, setBodyVisible] = useState(true);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isManualLog, setIsManualLog] = useState(false);
  const [manualReps, setManualReps] = useState(10);
  const [manualRpe, setManualRpe] = useState<number | null>(null);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [isEnding,       setIsEnding]       = useState(false);

  // ── Analyzing overlay ──────────────────────────────────────────────────────
  const [analyzingVisible,  setAnalyzingVisible]  = useState(false);
  const [analyzingApiDone,  setAnalyzingApiDone]  = useState(false);
  const [pendingResult, setPendingResult] = useState<
    | { type: "session"; results: Omit<SessionResultsProps, "onClose"> }
    | { type: "pov"; payload: RepReviewPayload; results: Omit<SessionResultsProps, "onClose"> }
    | null
  >(null);

  // ── Multi-set tracking ─────────────────────────────────────────────────────
  const [totalSets,  setTotalSets]  = useState(3);
  const [currentSet, setCurrentSet] = useState(1);
  const [setsLog,    setSetsLog]    = useState<Array<{ reps: number; holdSec: number }>>([]);
  const setStartRepCountRef  = useRef(0);
  const setStartHoldSecRef   = useRef(0);
  const flavorCueFiredThisSetRef = useRef(false);

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
  const voiceStateRef = useRef({ isResting: false, isWorkoutActive: false, isCameraInitializing: false });

  // Stable refs to the latest handler versions (avoids stale closures in voice)
  const handleEndSetRef       = useRef<() => Promise<void>>(async () => {});
  const handleStartNextSetRef = useRef<() => void>(() => {});
  const handleStopRef         = useRef<() => Promise<void>>(async () => {});
  const handleStartRef        = useRef<() => Promise<void>>(async () => {});
  /** Guards against double-firing End Workout (button + voice command race). */
  const isEndingRef           = useRef(false);

  // ── Voice personality ─────────────────────────────────────────────────────
  /** Active voice profile ID — read from preferences on mount, kept in a ref
   *  so the speakFormCue flush closure always sees the current value. */
  const voiceProfileIdRef = useRef<string>(getVoiceProfile());
  /** Current exercise name — kept in a ref so speakFormCue can access it
   *  without adding it to the useCallback dependency array. */
  const activeExerciseNameRef = useRef<string>("");

  // ── Equipment selection ────────────────────────────────────────────────────
  const [equipment, setEquipment] = useState<EquipmentSelection>(DEFAULT_EQUIPMENT);

  // ── Camera-init state (1-second ramp before workout goes live) ─────────────
  const [isCameraInitializing, setIsCameraInitializing] = useState(false);

  // ── Pro paywall — camera/AI tracking gate ──────────────────────────────────
  const [showCameraPaywall, setShowCameraPaywall] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const landmarkerRef      = useRef<PoseLandmarker | null>(null);
  const requestRef         = useRef<number>(0);
  const lastVideoTimeRef   = useRef<number>(-1);
  const workoutStartMsRef  = useRef<number>(0);
  /** Ref mirror of bodyVisible for use in worker callbacks (avoids stale closure). */
  const bodyVisibleRef         = useRef(true);
  /** Consecutive frames where ≥1 required landmark is below the visibility threshold. */
  const lowVisFramesRef        = useRef(0);
  /** Timestamp of the last "step back" voice cue so it doesn't fire too often. */
  const lastStepBackCueMsRef   = useRef(0);

  const stateRef = useRef({
    phase:              "up" as Phase,
    repCount:           0,
    lastSpokenTime:     0,  // motivational cue cooldown (4 s)
    lastPhaseCueMs:     0,  // phase-transition cue cooldown (2 s)
    lastFormCueMs:      0,  // form correction cue cooldown (5 s) — independent of motivational
    sessionStartTime:   0,
    sessionId:          0,
    repFormScores:      [] as number[],
    lastRepTime:        0,
    avgRepDurationMs:   0,  // rolling average rep duration for milestone detection
    holdSeconds:        0,
    lastHoldTickMs:     0,
    holdActive:         false,
    lastHoldSpeakSec:   -1,
    bestSyncPct:        0,
    lastSyncDropMs:     0,
  });

  const calibRef = useRef<{
    userScale: { wingspan: number; height: number } | null;
  }>({ userScale: null });

  // ── Saved body calibration data from the one-time calibration screen ───────
  const { data: calibrationApiData } = useGetCalibration();
  const savedCalibrationRef = useRef<{ wingspan: number; height: number } | null>(null);
  useEffect(() => {
    const d = calibrationApiData?.calibrationData;
    savedCalibrationRef.current = d ? { wingspan: d.wingspan, height: d.height } : null;
  }, [calibrationApiData]);

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

  // ── Velocity-based rep detection ─────────────────────────────────────────
  /** Previous frame's primary joint angle (°) — sent to the Worker each frame
   *  so it can detect velocity reversals for fast-movement rep counting. */
  const prevKeyAngleRef = useRef<number | null>(null);

  // ── Pose-processing Web Worker ────────────────────────────────────────────
  const workerRef            = useRef<Worker | null>(null);
  /** True while the Worker is processing a frame; prevents queue build-up. */
  const workerBusyRef        = useRef(false);
  /** Frame context stored while awaiting the Worker's async response. */
  const pendingFrameDataRef  = useRef<PendingFrameData | null>(null);
  /** Ref that always points to the latest handleFrameResult (avoids stale closure
   *  in the Worker's onmessage handler which is set up only once on mount). */
  const handleFrameResultRef = useRef<((out: WorkerOutputLocal, ctx: PendingFrameData) => void) | null>(null);

  // ── Form-cue accumulator (150 ms debounce window) ────────────────────────
  /**
   * All unique form-correction texts received in the current 150 ms window.
   * When the flush fires, they are concatenated into one coaching sentence
   * so the AI can say "keep those hips down AND tuck your elbows in"
   * instead of firing two separate clips back-to-back.
   */
  const pendingFormCuesRef = useRef<string[]>([]);
  /** setTimeout ID for flushing the pending form cues. */
  const cueFlushTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── "Stay in frame" cue cooldown ─────────────────────────────────────────
  /** Date.now() of the last "stay in frame" voice cue — 8 s cooldown. */
  const lastInFrameCueMsRef = useRef(0); // kept for backwards compat — superseded by lastStepBackCueMsRef

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

  const queryClient   = useQueryClient();
  const createSession = useCreateSession();
  const updateSession = useUpdateSession();
  const createRep     = useCreateRep();

  // ── Voice helpers ──────────────────────────────────────────────────────────
  /**
   * Motivational coaching cue — 4 s cooldown prevents rapid-fire speech.
   * Queued as MOTIVATIONAL priority: plays after form/phase cues finish,
   * never interrupts an active sentence.
   */
  const speak = useCallback((text: string, tone: "encouraging" | "firm" | "neutral" = "neutral") => {
    const now = Date.now();
    if (now - stateRef.current.lastSpokenTime < 4000) return;
    stateRef.current.lastSpokenTime = now;
    voiceSpeak(text, tone, CUE_PRIORITY.MOTIVATIONAL);
  }, []);

  /**
   * Phase-transition cue — independent 2 s cooldown.
   * Queued as PHASE priority: plays before motivational but after form corrections.
   * Pacer cues bypass this cooldown entirely (they use their own setTimeout).
   */
  const speakPhase = useCallback((text: string, tone: "encouraging" | "firm" | "neutral" = "neutral") => {
    const now = Date.now();
    if (now - stateRef.current.lastPhaseCueMs < 2000) return;
    stateRef.current.lastPhaseCueMs = now;
    voiceSpeak(text, tone, CUE_PRIORITY.PHASE);
  }, []);

  const lastSyncVoiceRef = useRef<number>(0);
  const speakSyncDrop = useCallback(() => {
    const now = Date.now();
    if (now - lastSyncVoiceRef.current < 5000) return;
    lastSyncVoiceRef.current = now;
    voiceSpeak(getWorkoutPhrase("Get back into position to continue.", i18n.language), "neutral", CUE_PRIORITY.PHASE);
  }, []);

  /**
   * Form-correction cue accumulator.
   *
   * Collects all form issue strings fired within a 150 ms window, then
   * concatenates them into a single coaching sentence and enqueues it at
   * FORM priority.  This prevents the AI from playing two separate clips
   * back-to-back when multiple issues are detected simultaneously.
   *
   * The combined text (e.g. "Lower your hips and tuck your elbows in") is
   * sent to the LLM which constructs one fluent personality-appropriate
   * sentence ("Watch your form — keep those hips down and tuck in those
   * elbows, recruit!").
   *
   * Uses an independent 5 s cooldown that does NOT share with motivational
   * cues, so a rep-count cue doesn't suppress the next form correction.
   */
  /** Generate a stable, URL-safe cache key from exercise name + cue text. */
  const makeCueCacheKey = useCallback((exercise: string, cue: string): string => {
    const slug = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30);
    const lang = i18n.language !== "en" ? i18n.language : "general";
    return `${lang}:${slug(exercise)}:${slug(cue)}`;
  }, [i18n.language]);

  const speakFormCue = useCallback((text: string) => {
    // Accumulate unique form issues in this 150 ms window
    if (!pendingFormCuesRef.current.includes(text)) {
      pendingFormCuesRef.current.push(text);
    }
    // Schedule the flush if not already pending
    if (!cueFlushTimerRef.current) {
      cueFlushTimerRef.current = setTimeout(() => {
        cueFlushTimerRef.current = null;
        const cues = pendingFormCuesRef.current;
        pendingFormCuesRef.current = [];
        if (!cues.length) return;
        // Independent 5 s cooldown — doesn't share with motivational cues
        const now = Date.now();
        if (now - stateRef.current.lastFormCueMs < 5000) return;
        stateRef.current.lastFormCueMs = now;
        // Concatenate multiple issues into one sentence for the LLM to render
        // as a single fluent correction ("hips down and elbows tucked").
        // Cap at 2 issues to keep the sentence digestible.
        const combined = cues.slice(0, 2).join(" and ");
        const exerciseName = activeExerciseNameRef.current;
        const profileId    = voiceProfileIdRef.current;
        if (exerciseName && profileId) {
          const cacheKey = makeCueCacheKey(exerciseName, combined);
          voiceSpeakCue(exerciseName, combined, profileId, cacheKey, CUE_PRIORITY.FORM);
        } else {
          voiceSpeak(combined, "firm", CUE_PRIORITY.FORM);
        }
      }, 150);
    }
  }, [makeCueCacheKey]);

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
        toast({ title: t("workout.poseTrackingUnavailable"), description: t("workout.poseTrackingDesc"), variant: "destructive" });
        return;
      }

      const modelAssetPath = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

      for (const delegate of ["GPU", "CPU"] as const) {
        try {
          const landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath, delegate },
            runningMode: "VIDEO",
            numPoses: 1,
            // Higher tracking confidence reduces jitter between frames
            // (equivalent to smoothLandmarks in the legacy MediaPipe API).
            minTrackingConfidence: 0.6,
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

  // ── Pose-processing Web Worker ─────────────────────────────────────────────
  //
  // The Worker runs the exercise state machine (config.processFrame + velocity
  // assist) off the main thread, freeing it for MediaPipe detection and UI
  // rendering.  MediaPipe itself must stay on the main thread because the GPU
  // delegate requires the WebGL context, but all the angle maths and rep logic
  // can run in a Worker without any browser-API access.
  //
  // Protocol:
  //   predictWebcam → Worker : WorkerInput  (landmarks, phase, exercise, …)
  //   Worker → onmessage     : WorkerOutput (phase result, rep flag, cues, …)
  //
  // If the Worker is busy when a new frame arrives, we fall back to synchronous
  // processing so no rep is ever missed.
  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/pose-processor.worker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (e: MessageEvent<WorkerOutputLocal | null>) => {
      workerBusyRef.current = false;
      if (!e.data || !pendingFrameDataRef.current) return;
      const ctx = pendingFrameDataRef.current;
      pendingFrameDataRef.current = null;
      // Store keyAngle for next frame's velocity calculation
      prevKeyAngleRef.current = e.data.keyAngle;
      handleFrameResultRef.current?.(e.data, ctx);
    };

    worker.onerror = () => { workerBusyRef.current = false; };

    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

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

  // ── handleFrameResult ──────────────────────────────────────────────────────
  //
  // Processes a result from the pose-processing Worker (or the sync fallback).
  // Receives the computed FrameResult alongside the frame context (landmarks,
  // ghost data, syncPct, exercise identity, previous phase) that was snapshotted
  // at the time of dispatch so that state reads are consistent.
  //
  const handleFrameResult = useCallback((
    output: WorkerOutputLocal,
    ctx:    PendingFrameData,
  ) => {
    const { landmarks, ghostLandmarks, ghostConfig, syncPct: currentSyncPct, exerciseId, prevPhase } = ctx;

    const exercise = exercises?.find(e => e.id.toString() === exerciseId);
    if (!exercise) return;

    // ── Update phase in shared state ──────────────────────────────────────
    stateRef.current.phase = output.newPhase;
    const phaseChanged = output.newPhase !== prevPhase;

    // ── Equipment modifier: rings stability bonus ──────────────────────────
    let equipBonus = 0;
    let equipCue: string | null = null;
    if (isPullExercise(exercise.name) && equipment.pullGear === "gymnastic-rings") {
      const jitter = equipModRef.current.wristJitter;
      if (jitter < RINGS_JITTER_THRESHOLD) {
        equipBonus = RINGS_STABILITY_BONUS;
      } else if (jitter > RINGS_JITTER_THRESHOLD * 2) {
        equipCue = getWorkoutPhrase("Steady the rings — control the swing.", i18n.language);
      }
    }
    if (isPushExercise(exercise.name) && equipment.pushGear === "floor" && equipModRef.current.wristOverextended) {
      equipCue = getWorkoutPhrase("Neutral wrists — don't let them bend back.", i18n.language);
    }

    const adjustedFormScore = Math.min(100, output.formScore + equipBonus);
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
    if (phaseChanged && !output.isStatic) {
      clearPacerTimeouts();

      if (voicePacingRef.current) {
        // ── Active Pacer: "Down... 2... 1... and Up!" ─────────────────────
        const isDescending =
          (output.newPhase === "down") ||
          (output.newPhase === "bottom" && (prevPhase === "up" || prevPhase === "top"));
        const isAscending  =
          (output.newPhase === "up") ||
          (output.newPhase === "top" && (prevPhase === "down" || prevPhase === "bottom"));

        if (isDescending) {
          DESCEND_PACER_CUES.forEach(cue => {
            const translated = getWorkoutPhrase(cue.text, i18n.language);
            const t = setTimeout(() => { voiceSpeak(translated, cue.tone, CUE_PRIORITY.PHASE); }, cue.delayMs);
            pacerTimeoutsRef.current.push(t);
          });
        } else if (isAscending) {
          voiceSpeak(getWorkoutPhrase(ASCEND_PACER_CUE.text, i18n.language), ASCEND_PACER_CUE.tone, CUE_PRIORITY.PHASE);
        }
      } else {
        // ── Standard phase-transition cue ─────────────────────────────────
        const phaseCue = getPhaseTransitionCue(exercise.name, prevPhase, output.newPhase);
        if (phaseCue) {
          speakPhase(getWorkoutPhrase(phaseCue.text, i18n.language), phaseCue.tone);
        }
      }
    }

    if (output.isStatic) {
      const holdNow = output.isHoldActive === true && synced && bodyVisibleRef.current;

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
          speak(getWorkoutPhrase("{n} seconds. Stay strong.", i18n.language).replace("{n}", String(totalSec)), tone);
        }
      }

      if (holdNow && !stateRef.current.holdActive) {
        speak(getWorkoutPhrase("Perfect sync — hold it.", i18n.language), "encouraging");
      } else if (!holdNow && stateRef.current.holdActive) {
        if (synced) {
          speak(output.audioCue ?? getWorkoutPhrase("Adjust your position.", i18n.language), tone);
        }
      }

      stateRef.current.holdActive     = holdNow;
      stateRef.current.lastHoldTickMs = holdNow ? now : 0;
      setIsInActiveZone(holdNow);

      stateRef.current.repFormScores.push(blendedScore);
      setFormScore(prev => prev * 0.9 + blendedScore * 0.1);
    } else {
      const { repCounted, repQuality, audioCue } = output;

      if (repCounted && synced && bodyVisibleRef.current) {
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
            repNumber:      newRepCount,
            syncPct:        Math.round(currentSyncPct),
            formScore:      blendedScore,
            userLandmarks:  landmarks.map(l => ({ ...l })),
            ghostLandmarks: ghostLandmarks.map(l => ({ ...l })),
          };
          recorderRef.current?.logBestRep(repData);
        }

        createRep.mutate({
          sessionId: stateRef.current.sessionId,
          data: {
            repNumber:     newRepCount,
            formScore:     blendedScore,
            durationMs:    duration > 0 ? duration : null,
            feedbackGiven: audioCue ?? equipCue ?? null,
          },
        });

        // ── Rep completion cue ─────────────────────────────────────────────
        // Milestone: if this rep took >1.6× the average, the user is fatiguing
        const isFatiguing =
          stateRef.current.avgRepDurationMs > 0 &&
          duration > stateRef.current.avgRepDurationMs * 1.6 &&
          newRepCount >= 3;

        const isFirstRepOfSet = (newRepCount - setStartRepCountRef.current) === 1;

        if (repQuality === "incomplete") {
          speak(getWorkoutPhrase("Incomplete rep — go deeper next time", i18n.language), "firm");
        } else if (isFatiguing) {
          const milestone = getMilestoneCue();
          speak(getWorkoutPhrase(milestone.text, i18n.language), milestone.tone);
        } else if (newRepCount % 5 === 0) {
          const motivational = getMotivationalCue(exercise.name);
          speak(getWorkoutPhrase(motivational.text, i18n.language), motivational.tone);
        } else if (isFirstRepOfSet && !flavorCueFiredThisSetRef.current && getFlavorMode()) {
          const flavor = getFlavorCue(exercise.name);
          speak(getWorkoutPhrase(flavor.text, i18n.language), flavor.tone);
          flavorCueFiredThisSetRef.current = true;
        } else {
          speak(getWorkoutPhrase("Good rep", i18n.language), "neutral");
        }
      } else if (repCounted && !synced) {
        speak(getWorkoutPhrase("Match the ghost to earn that rep.", i18n.language), "neutral");
      } else if (equipCue) {
        speak(equipCue, tone);
      } else if (audioCue) {
        // Form correction — accumulator (150 ms window) collects all issues
        // and concatenates them into one coaching sentence before speaking.
        speakFormCue(audioCue);
      }

      setFormScore(prev => prev * 0.9 + blendedScore * 0.1);
    }
  }, [exercises, speak, speakPhase, speakSyncDrop, speakFormCue, createRep, equipment, clearPacerTimeouts]);

  // Keep the ref current so the Worker's onmessage closure always calls the
  // latest version without re-binding the handler.
  useEffect(() => { handleFrameResultRef.current = handleFrameResult; });

  // ── processFrame ───────────────────────────────────────────────────────────
  //
  // Dispatches the current frame to the pose-processing Worker.  All the heavy
  // angle computation and state-machine logic runs off the main thread.
  //
  // If the Worker is still processing the previous frame (rare at 30 fps), we
  // fall back to synchronous processing so no rep is ever silently dropped.
  //
  const processFrame = useCallback((
    landmarks:      Landmark[],
    ghostLandmarks: Landmark[],
    ghostConfig:    GhostExerciseConfig | null,
    currentSyncPct: number,
  ) => {
    const exercise = exercises?.find(e => e.id.toString() === selectedExerciseId);
    if (!exercise) return;
    const config = getExerciseConfig(exercise.name);
    if (!config) return;

    const prevPhase = stateRef.current.phase as Phase;
    const equipCtx: EquipmentContext = {
      pushDepthThreshold: isPushExercise(exercise.name)
        ? getPushDepthThreshold(equipment.pushGear)
        : undefined,
    };

    const ctx: PendingFrameData = {
      landmarks, ghostLandmarks, ghostConfig,
      syncPct:      currentSyncPct,
      exerciseId:   exercise.id.toString(),
      exerciseName: exercise.name,
      prevPhase,
    };

    const worker = workerRef.current;
    if (worker && !workerBusyRef.current) {
      // Off-thread path: dispatch to Worker; result arrives in onmessage
      workerBusyRef.current      = true;
      pendingFrameDataRef.current = ctx;
      worker.postMessage({
        landmarks,
        prevPhase,
        exerciseName: exercise.name,
        equipment:    equipCtx,
        prevKeyAngle: prevKeyAngleRef.current,
        frameDeltaMs: lastDetectMsRef.current > 0
          ? performance.now() - lastDetectMsRef.current
          : 0,
      });
    } else {
      // Sync fallback: Worker unavailable or still busy with previous frame
      const result = config.processFrame(landmarks, prevPhase, equipCtx);
      const syncOutput: WorkerOutputLocal = {
        repCounted:      result.repCounted,
        repQuality:      result.repQuality,
        newPhase:        result.newPhase,
        formScore:       result.formScore,
        audioCue:        result.audioCue,
        isHoldActive:    result.isHoldActive,
        isStatic:        config.isStatic,
        keyAngle:        null,
        velocityAssisted: false,
      };
      prevKeyAngleRef.current = null;
      handleFrameResultRef.current?.(syncOutput, ctx);
    }
  }, [exercises, selectedExerciseId, equipment]);

  // ── Main camera loop ───────────────────────────────────────────────────────
  //
  // Architecture:
  //   • MediaPipe detection runs at ~30 fps (every DETECT_INTERVAL_MS = 33 ms).
  //   • Exercise state-machine logic is dispatched to a Web Worker; the result
  //     arrives asynchronously via onmessage so the main thread is never blocked
  //     by angle computations during the render phase.
  //   • Velocity-based rep detection is applied in the Worker to catch fast
  //     movements that only appear in a single detection frame at the bottom.
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

    // ── Detection phase (~30 fps) ──────────────────────────────────────────
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

        // ── Visibility Guard ──────────────────────────────────────────────
        // Check that every landmark required for the current exercise is
        // visible above the 0.65 threshold.  Uses 4-frame temporal smoothing
        // so a single bad detection doesn't falsely freeze the counter.
        {
          const exerciseNameNow = exercises?.find(e => e.id.toString() === selectedExerciseId)?.name ?? "";
          const requiredLMs     = getRequiredLandmarks(exerciseNameNow);
          const anyLow          = requiredLMs.some(idx => (raw[idx]?.visibility ?? 1) < 0.65);

          if (anyLow) {
            lowVisFramesRef.current = Math.min(lowVisFramesRef.current + 1, 8);
          } else {
            lowVisFramesRef.current = Math.max(lowVisFramesRef.current - 1, 0);
          }

          const nowVisible = lowVisFramesRef.current < 4;
          if (nowVisible !== bodyVisibleRef.current) {
            bodyVisibleRef.current = nowVisible;
            setBodyVisible(nowVisible);
          }

          // Fire a step-back cue at most once every 8 s when body leaves frame
          if (!nowVisible && stateRef.current.sessionId !== 0) {
            const nowMs = Date.now();
            if (nowMs - lastStepBackCueMsRef.current > 8000) {
              lastStepBackCueMsRef.current = nowMs;
              voiceSpeak(
                getWorkoutPhrase("Step back so your full body is visible.", i18n.language),
                "neutral",
                CUE_PRIORITY.PHASE,
              );
            }
          }
        }

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

        // Visibility Guard interlock: freeze Ghost Sync at 0% when body is not
        // fully in frame so 'Locked In' never activates.
        if (!bodyVisibleRef.current) {
          currentSyncPct = 0;
        }

        // Rotate buffers: prev ← curr ← new
        prevSmoothedRef.current    = currSmoothedRef.current;
        prevDetectMsRef.current    = lastDetectMsRef.current;
        currSmoothedRef.current    = smoothed;
        currGhostRef.current       = phasedGhost;
        currGhostConfigRef.current = ghostConfig;
        currSyncPctRef.current     = currentSyncPct;
        lastDetectMsRef.current    = now;

        // Dispatch to Worker (or sync fallback) for exercise state machine
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

  // ── Camera on/off: runs whenever camera-init, workout, or resting ────────────
  useEffect(() => {
    const anyActive = isCameraInitializing || isWorkoutActive || isResting;
    if (anyActive) {
      startCamera();
    }
    if (!anyActive) {
      cancelAnimationFrame(requestRef.current);
      stopCamera();
      cancelSpeech();
    }
    return () => {
      if (!isCameraInitializing && !isWorkoutActive && !isResting) {
        cancelAnimationFrame(requestRef.current);
        stopCamera();
        cancelSpeech();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCameraInitializing, isWorkoutActive, isResting]);

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
      toast({ title: t("workout.selectExerciseFirst"), description: t("workout.pickExerciseFirst") });
      return;
    }
    // Gate AI camera tracking behind Pro
    if (!isPro) {
      setShowCameraPaywall(true);
      return;
    }
    // Eagerly unlock the AudioContext during this user-gesture click so ElevenLabs
    // audio can play without hitting the browser autoplay restriction later.
    try {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") await ctx.resume();
    } catch {
      // Non-fatal — ElevenLabs will attempt resume() again when the first cue fires.
    }
    try {
      const session = await createSession.mutateAsync({
        data: { exerciseId: parseInt(selectedExerciseId) },
      });
      const selectedExercise = exercises?.find(e => e.id.toString() === selectedExerciseId);
      const config = selectedExercise ? getExerciseConfig(selectedExercise.name) : null;

      stateRef.current = {
        phase:              config?.initialPhase ?? "up",
        repCount:           0,
        lastSpokenTime:     Date.now(),
        lastPhaseCueMs:     0,
        lastFormCueMs:      0,
        sessionStartTime:   Date.now(),
        sessionId:          session.id,
        repFormScores:      [],
        lastRepTime:        Date.now(),
        avgRepDurationMs:   0,
        holdSeconds:        0,
        lastHoldTickMs:     0,
        holdActive:         false,
        lastHoldSpeakSec:   -1,
        bestSyncPct:        0,
        lastSyncDropMs:     0,
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

      // ── Apply saved calibration & start camera ─────────────────────────────
      calibRef.current = { userScale: savedCalibrationRef.current };
      setIsCameraInitializing(true);
      setTimeout(() => {
        workoutStartMsRef.current = Date.now();
        setIsCameraInitializing(false);
        setIsWorkoutActive(true);
      }, 1200);

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
    setAnalyzingVisible(true);
    setAnalyzingApiDone(false);

    // Stop the rest timer immediately so it can't fire during the async save.
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
    setIsResting(false);
    setRestSeconds(0);

    // Immediately silence TTS and stop the mic so neither stays active
    // during the async save / navigation transition.
    cancelSpeech();
    voiceCommandsEnabledRef.current = false;
    try { speechRecognitionRef.current?.stop(); } catch {}
    speechRecognitionRef.current = null;
    setIsListening(false);

    setIsWorkoutActive(false);
    setIsCameraInitializing(false);
    voiceSpeak(getWorkoutPhrase("Workout complete.", i18n.language));

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
      console.log("Attempting to save workout...", { sessionId: finalSessionId, exerciseName, finalReps, finalFormScore });
      // Wait for the DB write to succeed before showing the summary screen.
      const sessionResult = await updateSession.mutateAsync({
        id:   finalSessionId,
        data: {
          completedAt:  new Date().toISOString(),
          totalReps:    finalReps,
          avgFormScore: finalFormScore,
          sets:         currentSet,
          ...(frozenDetectedRef.current ? { isVerified: false } : {}),
        },
      }) as unknown as {
        newBadges?: Array<{ id: string; name: string; icon: string; category: string; tier: string }>;
        newExerciseTiers?: Array<{ exerciseName: string; tier: string; title: string; icon: string }>;
      };

      console.log("Save successful!", sessionResult);

      // Immediately refresh History and Dashboard so the new entry is visible
      void queryClient.refetchQueries({ queryKey: getListSessionsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetRecentSessionsQueryKey() });

      // Trigger full-screen badge celebration modal for newly earned category badges
      const milestones = sessionResult?.newBadges ?? [];
      if (milestones.length > 0) {
        const badgeDefs = milestones
          .map((b) => MILESTONE_BADGE_MAP.get(b.id))
          .filter((b): b is NonNullable<typeof b> => b !== undefined);
        setTimeout(() => triggerBadgeCelebrations(badgeDefs), 900);
      }

      // Show mastery tier toasts for newly earned per-exercise titles
      const exerciseTiers = sessionResult?.newExerciseTiers ?? [];
      for (const et of exerciseTiers) {
        setTimeout(() => {
          toast({
            title: t("workout.newTitle", { icon: et.icon, title: et.title }),
            description: t("workout.newTitleDesc", { exercise: et.exerciseName, tier: et.tier }),
          });
        }, 1200);
      }

      const newSession: SessionSummary = {
        exerciseName,
        totalReps:    finalReps,
        avgFormScore: finalFormScore,
        completedAt:  new Date().toISOString(),
      };
      const nextEvaluated = evaluateSkillTree([...history, newSession]);

      // Detect and celebrate newly mastered skill nodes
      const newlyMastered1 = nextEvaluated.filter(n => {
        const prev = prevEvaluated.find(p => p.id === n.id);
        return n.status === "mastered" && prev?.status !== "mastered";
      });
      if (newlyMastered1.length > 0) {
        const celebrations: SkillMasteryCelebration[] = newlyMastered1.map(masteredNode => ({
          masteredNode,
          newlyUnlockedNodes: nextEvaluated.filter(n => {
            const prev = prevEvaluated.find(p => p.id === n.id);
            return n.status === "unlocked" && prev?.status === "locked";
          }),
        }));
        setTimeout(() => triggerSkillMasteryCelebrations(celebrations), 2400);
      }

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
          setPendingResult({ type: "pov", payload: reviewPayload, results: resultsProps });
        } else {
          recorder?.destroy();
          setPendingResult({ type: "session", results: resultsProps });
        }
      } else {
        recorder?.destroy();
        setPendingResult({ type: "session", results: resultsProps });
      }

      // Signal the analyzing overlay that the API work is complete
      setAnalyzingApiDone(true);
    } catch (error) {
      console.error("Database Save Failed:", error);
      recorder?.destroy();
      setAnalyzingVisible(false);
      toast({ title: "Save error", description: "Failed to save session. Please try again.", variant: "destructive" });
    } finally {
      isEndingRef.current = false;
      setIsEnding(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Full workout state reset — called when the user dismisses the results overlay
  // so the page returns cleanly to the exercise-selection state.
  // ─────────────────────────────────────────────────────────────────────────────
  const resetWorkoutState = () => {
    // Kill the rest timer immediately so it doesn't keep firing
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }

    // Kill any pending pacer voice cues
    clearPacerTimeouts();
    if (cueFlushTimerRef.current) {
      clearTimeout(cueFlushTimerRef.current);
      cueFlushTimerRef.current = null;
    }

    // Silence TTS and stop voice recognition
    cancelSpeech();
    voiceCommandsEnabledRef.current = false;
    try { speechRecognitionRef.current?.stop(); } catch {}
    speechRecognitionRef.current = null;

    // Reset all workout-active flags
    setIsWorkoutActive(false);
    setIsCameraInitializing(false);
    setIsResting(false);
    setRestSeconds(0);
    setIsListening(false);
    setIsEnding(false);
    isEndingRef.current = false;

    // Reset multi-set state
    setCurrentSet(1);
    setSetsLog([]);

    // Reset per-rep display state
    setReps(0);
    setHoldSeconds(0);
    setFormScore(100);
    setSyncPct(100);
    setIsInActiveZone(false);

    // Reset internal rep-tracking ref so a new session starts clean
    stateRef.current = {
      ...stateRef.current,
      phase:            "up",
      repCount:         0,
      lastSpokenTime:   0,
      lastPhaseCueMs:   0,
      sessionStartTime: 0,
      sessionId:        0,
      repFormScores:    [],
      lastRepTime:      0,
      avgRepDurationMs: 0,
      holdSeconds:      0,
      lastHoldTickMs:   0,
      holdActive:       false,
      lastHoldSpeakSec: -1,
      bestSyncPct:      0,
      lastSyncDropMs:   0,
    };

    frozenDetectedRef.current = false;
    frozenCheckRef.current    = { lastTime: -1, sinceMs: 0 };
    bestRepSyncRef.current    = 0;
    prevKeyAngleRef.current   = null;

    // Destroy any lingering recorder
    if (recorderRef.current) {
      recorderRef.current.destroy();
      recorderRef.current = null;
    }

    // Close overlays
    setSessionResults(null);
    setPovReview(null);

    // Return to exercise-selection state
    setSelectedExerciseId("");
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
      voiceSpeak(getWorkoutPhrase("Set {n} done. Workout complete!", i18n.language).replace("{n}", String(currentSet)));
      await handleStop();
    } else {
      // More sets to go — start rest timer
      voiceSpeak(getWorkoutPhrase("Set {n} done. Rest up.", i18n.language).replace("{n}", String(currentSet)), "encouraging");
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

    flavorCueFiredThisSetRef.current = false;

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

    // Apply saved calibration & start camera for the next set
    calibRef.current = { userScale: savedCalibrationRef.current };
    setIsCameraInitializing(true);
    setTimeout(() => {
      workoutStartMsRef.current = Date.now();
      setIsCameraInitializing(false);
      setIsWorkoutActive(true);
    }, 1200);
  };

  /** Manual Log: saves a user-entered rep count (no camera / AI form scoring). */
  const handleManualLog = async () => {
    if (!selectedExerciseId) {
      toast({ title: "Select an exercise", description: "Pick an exercise first." });
      return;
    }
    setIsSavingManual(true);
    setAnalyzingVisible(true);
    setAnalyzingApiDone(false);
    try {
      console.log("Attempting to save workout...", { exerciseId: selectedExerciseId, type: "manual", reps: manualReps });
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

      const manualResult = await updateSession.mutateAsync({
        id:   session.id,
        data: {
          completedAt: new Date().toISOString(),
          totalReps:   manualReps,
          rpe:         manualRpe ?? undefined,
          isVerified:  false,
          sets:        1,
        },
      });
      console.log("Save successful!", manualResult);
      void queryClient.refetchQueries({ queryKey: getListSessionsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetRecentSessionsQueryKey() });

      const newSession: SessionSummary = {
        exerciseName,
        totalReps:    manualReps,
        avgFormScore: null,
        completedAt:  new Date().toISOString(),
      };
      const nextEvaluated = evaluateSkillTree([...history, newSession]);

      // Detect and celebrate newly mastered skill nodes
      const newlyMastered2 = nextEvaluated.filter(n => {
        const prev = prevEvaluated.find(p => p.id === n.id);
        return n.status === "mastered" && prev?.status !== "mastered";
      });
      if (newlyMastered2.length > 0) {
        const celebrations: SkillMasteryCelebration[] = newlyMastered2.map(masteredNode => ({
          masteredNode,
          newlyUnlockedNodes: nextEvaluated.filter(n => {
            const prev = prevEvaluated.find(p => p.id === n.id);
            return n.status === "unlocked" && prev?.status === "locked";
          }),
        }));
        setTimeout(() => triggerSkillMasteryCelebrations(celebrations), 900);
      }

      setIsManualLog(false);
      setManualReps(10);
      setManualRpe(null);
      setPendingResult({
        type: "session",
        results: {
          exerciseName,
          totalReps:    manualReps,
          avgFormScore: null,
          sessionId:    session.id,
          bestSyncPct:  undefined,
          prevEvaluated,
          nextEvaluated,
        },
      });
      setAnalyzingApiDone(true);
    } catch (error) {
      console.error("Database Save Failed:", error);
      setAnalyzingVisible(false);
      toast({ title: "Error", description: "Could not save workout.", variant: "destructive" });
    } finally {
      setIsSavingManual(false);
    }
  };

  // ── Analyzing overlay completion — hand off to the correct results screen ──
  const handleAnalyzingComplete = useCallback(() => {
    setAnalyzingVisible(false);
    setAnalyzingApiDone(false);
    if (pendingResult?.type === "pov") {
      setPovReview({ payload: pendingResult.payload, results: pendingResult.results });
    } else if (pendingResult?.type === "session") {
      setSessionResults(pendingResult.results);
    }
    setPendingResult(null);
  }, [pendingResult]);

  // ── Keep handler refs current (runs every render — no hooks violation) ────────
  handleEndSetRef.current       = handleEndSet;
  handleStartNextSetRef.current = handleStartNextSet;
  handleStopRef.current         = handleStop;
  handleStartRef.current        = handleStart;

  // ── Sync voiceStateRef so recognition closure reads fresh booleans ──────────
  useEffect(() => {
    voiceStateRef.current = { isResting, isWorkoutActive, isCameraInitializing };
  }, [isResting, isWorkoutActive, isCameraInitializing]);

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
          voiceSpeak(getWorkoutPhrase("Rest over. Get ready for the next set.", i18n.language));
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
    const cameraOn = isCameraInitializing || isWorkoutActive || isResting;
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
        else if (!vs.isWorkoutActive && !vs.isCameraInitializing) void handleStartRef.current();
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
  }, [voiceCommandsEnabled, isCameraInitializing, isWorkoutActive, isResting, toast]);

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

  const cameraActive = isCameraInitializing || isWorkoutActive || isResting;

  return (
    <div className="bg-background text-foreground min-h-full">

      {/* ── Analyzing Performance overlay ───────────────────────────────────── */}
      <AnalyzingOverlay
        visible={analyzingVisible}
        apiDone={analyzingApiDone}
        onComplete={handleAnalyzingComplete}
      />

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
            onClose={resetWorkoutState}
          />
        </div>
      )}

      {/* ── Camera / AI Tracking Pro Paywall ────────────────────────────────── */}
      <Dialog open={showCameraPaywall} onOpenChange={(open) => { if (!open) setShowCameraPaywall(false); }}>
        <DialogContent
          className="max-w-sm border p-0 overflow-hidden bg-white"
          style={{
            borderRadius: 24,
            border: "1px solid rgba(0,0,0,0.10)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.14)",
          }}
        >
          <div className="flex flex-col items-center text-center p-7 space-y-5">
            {/* Icon */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: "rgba(23,117,72,0.10)",
                border: "1px solid rgba(23,117,72,0.25)",
              }}
            >
              <Crown className="w-8 h-8" style={{ color: "#177548" }} />
            </div>

            {/* Copy */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] mb-1.5 text-primary">
                {t("shop.proLabel", "Pro Feature")}
              </div>
              <DialogTitle className="text-xl font-black text-foreground">
                {t("workout.proPaywallTitle", "Unlock Live Form Tracking")}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {t("workout.proPaywallDesc", "Get real-time position analysis, joint angle calibration, and automatic rep calculation with a Pro plan.")}
              </p>
            </div>

            {/* Features */}
            <div className="w-full space-y-2 text-left">
              {[
                { icon: "🎯", label: t("workout.featureFormScoring", "Live form scoring & feedback") },
                { icon: "📊", label: t("workout.featureRepCounting", "Automatic rep counting") },
                { icon: "👻", label: t("workout.featureGhostMode", "Ghost Mode AR overlay") },
                { icon: "✅", label: t("workout.featureVerified", "Verified session badge") },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "rgba(23,117,72,0.08)", border: "1px solid rgba(23,117,72,0.18)" }}
                  >
                    <EmojiIcon emoji={icon} className="w-4 h-4 object-contain" />
                  </div>
                  <span className="text-sm text-foreground/80">{label}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="w-full space-y-3 pt-1">
              <button
                onClick={() => { setShowCameraPaywall(false); setLocation("/shop"); }}
                className="w-full py-3.5 rounded-xl text-sm font-black tracking-wide transition-all"
                style={{
                  background: "#177548",
                  color: "#fff",
                  boxShadow: "0 4px 18px rgba(23,117,72,0.30)",
                }}
              >
                {t("progress.startTrial", "Start 3-Day Free Trial")}
              </button>
              <p className="text-[10px] text-muted-foreground/60">{t("progress.trialNote", "Cancel any time · No charge today")}</p>
              <button
                onClick={() => setShowCameraPaywall(false)}
                className="w-full py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

                  {/* ── Skill Tree note (informational only — does NOT block training) ── */}
                  {isLocked && (
                    <div
                      className="rounded-xl border p-4 space-y-2"
                      style={{
                        background: "rgba(23,117,72,0.06)",
                        borderColor: "rgba(23,117,72,0.22)",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                        <span className="text-sm font-bold text-primary">{t("workout.skillTreeNote", { defaultValue: "Skill Tree — Not Yet Mastered" })}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {prereqNode
                          ? t("workout.skillTreeNotePrereq", { title: prereqNode.title, defaultValue: `Master ${prereqNode.title} first to unlock this node in the Skill Tree. You can still practise this exercise freely.` })
                          : t("workout.skillTreeNoteGeneric", { defaultValue: "Complete the prerequisites in the Skill Tree to unlock this node. You can still practise this exercise freely." })
                        }
                      </p>
                      <button
                        className="flex items-center gap-2 w-full justify-center px-3 py-2 rounded-lg border border-primary/20 bg-primary/[0.08] text-xs font-semibold text-primary/80 hover:bg-primary/[0.14] transition-colors"
                        onClick={() => {
                          setInfoExercise(null);
                          setLocation(infoExercise.nodeId
                            ? `/skill-tree?node=${infoExercise.nodeId}`
                            : "/skill-tree"
                          );
                        }}
                      >
                        <Activity className="w-3 h-3" />
                        {t("workout.viewSkillTree")}
                      </button>
                    </div>
                  )}

                  {/* ── Target Muscles ────────────────────────────────────── */}
                  {infoEx && infoEx.muscleGroups.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Info className="w-3 h-3" /> {t("workout.targetMuscles")}
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
                        <Crosshair className="w-3 h-3 text-primary" /> {t("workout.criticalJoints")}
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

                  {/* ── Recommended Warm-up ───────────────────────────────── */}
                  {(() => {
                    const warmups = getWarmupSuggestionsFor(infoExercise.name);
                    if (!warmups.length) return null;
                    return (
                      <div className="rounded-lg border border-primary/25 bg-primary/[0.05] p-3">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2 flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3" /> Recommended Warm-up
                        </div>
                        <ul className="space-y-2">
                          {warmups.map(s => (
                            <li key={s.id} className="flex items-start gap-2">
                              <ChevronRight className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-foreground">{s.name}</span>
                                <span className="text-[10px] text-muted-foreground ml-2 inline-flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />{formatTime(s.durationSeconds)}
                                </span>
                                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{s.why}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}

                  {/* ── Train action button — always available ────────────── */}
                  <Button
                    className="w-full font-bold mt-2"
                    onClick={() => {
                      if (infoExercise) setSelectedExerciseId(infoExercise.id.toString());
                      setInfoExercise(null);
                    }}
                  >
                    {t("workout.trainExercise", { name: infoExercise.name })}
                  </Button>
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

          {/* Visibility Guard — "Step Back" warning overlay */}
          {isWorkoutActive && !bodyVisible && (
            <div className="absolute inset-x-0 top-0 z-30 flex justify-center pt-4 pointer-events-none select-none">
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{
                  background: "rgba(239,68,68,0.85)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  backdropFilter: "blur(6px)",
                  boxShadow: "0 0 18px 4px rgba(239,68,68,0.5)",
                }}
              >
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Step Back — Body Not Fully Visible
              </div>
            </div>
          )}

          {/* Border glow override when body is not visible */}
          {isWorkoutActive && !bodyVisible && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ boxShadow: "inset 0 0 0 5px rgba(239,68,68,0.7)" }}
            />
          )}

          {/* Camera-initializing spinner */}
          {isCameraInitializing && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none select-none">
              <div
                className="px-6 py-5 rounded-2xl text-center backdrop-blur-sm flex flex-col items-center gap-3"
                style={{ background: "rgba(0,0,0,0.72)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-sm font-semibold text-white/90">{t("workout.cameraInitializing")}</p>
              </div>
            </div>
          )}

          {/* Border glow — suppressed when Visibility Guard is active (red glow takes over) */}
          {isWorkoutActive && bodyVisible && (
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
                  {t("workout.setOfTotal", { current: currentSet, total: totalSets })}
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
                {minimalistMode ? t("workout.minimalist") : t("workout.fullSkeleton")}
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
                {t("workout.voicePacing")}
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
                  {t("workout.listeningLabel")}
                </div>
              )}
            </div>
          )}

          {/* Ghost Mode badge */}
          {isWorkoutActive && hasGhostConfig && (
            <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5 select-none">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 border border-cyan-500/40 text-xs font-semibold text-cyan-300">
                <Ghost className="w-3.5 h-3.5" />
                {t("workout.ghostMode")}
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
                  <span className="text-sm font-mono text-white/70 uppercase tracking-widest">{t("workout.holdTime")}</span>
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
                    {isInActiveZone ? t("workout.syncedHoldIt") : t("workout.matchGhost")}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <span className="text-sm font-mono text-white/70 uppercase tracking-widest">{t("workout.repsLabel")}</span>
                  <span className="text-8xl font-black text-primary leading-none tracking-tighter drop-shadow-lg">
                    {reps - setStartRepCountRef.current}
                  </span>
                </div>
              )}

              {hasGhostConfig && (
                <div className="flex flex-col items-center gap-1 mb-1">
                  <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">{t("workout.ghostSync")}</span>
                  <div className="text-4xl font-black tabular-nums leading-none" style={{ color: syncColor.text }}>
                    {syncPct}%
                  </div>
                  <div
                    className="mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                    style={{ backgroundColor: syncColor.bg, border: `1px solid ${syncColor.border}`, color: syncColor.text }}
                  >
                    {syncPct >= SYNC_GATE ? t("workout.lockedIn") : t("workout.adjust")}
                  </div>
                </div>
              )}

              <div className="flex flex-col items-center w-28">
                <span className="text-sm font-mono text-white/70 uppercase tracking-widest mb-2">{t("workout.formLabel")}</span>
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
                  {t("workout.restLabel")}
                </div>
                <div
                  className="text-9xl font-black tabular-nums leading-none tracking-tighter"
                  style={{ color: restSeconds <= 10 ? "#ef4444" : "#22c55e" }}
                >
                  {restSeconds}
                </div>
                <div className="text-white/35 text-sm font-medium">
                  {t("workout.nextSetOf", { next: currentSet + 1, total: totalSets })}
                </div>
                <button
                  onClick={handleStartNextSet}
                  className="flex items-center gap-2 px-6 py-3 rounded-full border border-primary/40 bg-primary/10 text-primary text-sm font-bold hover:bg-primary/20 transition-colors"
                >
                  <SkipForward className="w-4 h-4" />
                  {t("workout.startNow")}
                </button>
                <button
                  onClick={handleStop}
                  disabled={isEnding}
                  className="text-xs text-white/25 hover:text-white/50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  {t("workout.endWorkout")}
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
                {t("workout.endSetN", { set: currentSet })}
              </Button>
              {totalSets > 1 && (
                <button
                  className="text-xs text-white/30 hover:text-white/60 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  onClick={handleStop}
                  disabled={isEnding}
                >
                  {t("workout.endWorkoutEarly")}
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
              <h1 className="text-xl font-extrabold tracking-tight leading-none">{t("workout.workoutTitle")}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{t("workout.workoutSubtitle")}</p>
            </div>
          </div>

          {/* ── Exercise picker — two independent comboboxes ─────────────── */}
          {(() => {
            // Derive selected labels for each column from the shared selectedExerciseId
            let bwSelectedLabel: string | null = null;
            for (const cat of EXERCISE_CATEGORIES) {
              const entry = cat.exercises.find(e => exercises?.find(ex => ex.name === e.dbName)?.id.toString() === selectedExerciseId);
              if (entry) { bwSelectedLabel = entry.label; break; }
            }
            let eqSelectedLabel: string | null = null;
            for (const cat of EQUIPMENT_SPECIALTY_CATEGORIES) {
              const entry = cat.exercises.find(e => exercises?.find(ex => ex.name === e.dbName)?.id.toString() === selectedExerciseId);
              if (entry) { eqSelectedLabel = entry.label; break; }
            }

            // Shared row-item renderer for each exercise row in the dropdown list
            const BwRow = ({ item, branchColor }: { item: ExerciseEntry & { id: number }; branchColor: string }) => {
              const locked = isExerciseLocked(item.nodeId);
              const isSelected = item.id.toString() === selectedExerciseId;
              return (
                <div
                  className={`flex items-center gap-1 border-b border-border/20 group transition-colors ${isSelected ? "" : "hover:bg-white/[0.04]"}`}
                  style={isSelected ? { background: `${branchColor}20` } : undefined}
                >
                  <button
                    className="flex-1 text-left text-xs px-3 py-2.5 truncate flex items-center gap-1.5 cursor-pointer"
                    style={isSelected ? { color: branchColor, fontWeight: 600 } : undefined}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      setSelectedExerciseId(item.id.toString());
                      setBwOpen(false);
                      setBwInputVal(item.label);
                      setEqInputVal("");
                    }}
                  >
                    <span className="truncate">{item.label}</span>
                  </button>
                  <button
                    className="p-1.5 mr-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all shrink-0"
                    onMouseDown={e => e.preventDefault()}
                    onClick={e => { e.stopPropagation(); setInfoExercise({ name: item.dbName, id: item.id, nodeId: item.nodeId }); }}
                  >
                    <Info className="w-3 h-3" />
                  </button>
                </div>
              );
            };

            return (
              /* position+zIndex creates ONE stacking context above Sets/Ready cards */
              <div className="grid grid-cols-2 gap-3" style={{ position: "relative", zIndex: 50 }}>

                {/* ══ LEFT: Bodyweight Fundamentals ══════════════════════════ */}
                {/* No backdropFilter — avoids creating a nested stacking context that clips the dropdown */}
                <div
                  className="rounded-2xl border border-border p-3 flex flex-col gap-2 bg-white"
                  style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}
                >
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3 h-3 text-primary/70 shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-primary/80">{t("workout.bodyweight")}</span>
                  </div>

                  {/* BW Combobox */}
                  <div className="relative">
                    {/* Input */}
                    <div className="relative flex items-center">
                      <Search className="absolute left-2.5 w-3 h-3 text-muted-foreground pointer-events-none shrink-0" />
                      <input
                        ref={bwInputRef}
                        disabled={isModelLoading}
                        value={bwOpen ? bwInputVal : (bwSelectedLabel ?? "")}
                        placeholder={isModelLoading ? t("workout.loadingModel") : t("workout.searchPlaceholder")}
                        autoComplete="off"
                        className="w-full pl-7 pr-7 py-2.5 text-xs font-semibold bg-muted/50 border border-border rounded-xl outline-none transition-colors placeholder:text-muted-foreground placeholder:font-normal disabled:opacity-40 truncate"
                        style={bwOpen ? { borderColor: "rgba(23,117,72,0.4)" } : undefined}
                        onFocus={() => { setBwOpen(true); setBwInputVal(""); setEqOpen(false); }}
                        onChange={e => { setBwInputVal(e.target.value); }}
                        onBlur={() => { setTimeout(() => setBwOpen(false), 150); }}
                      />
                      <button
                        className="absolute right-2 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                        onMouseDown={e => {
                          e.preventDefault();
                          if (bwOpen) { setBwOpen(false); }
                          else { setBwInputVal(""); setBwOpen(true); setEqOpen(false); bwInputRef.current?.focus(); }
                        }}
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${bwOpen ? "rotate-180" : ""}`} />
                      </button>
                    </div>

                    {/* Floating dropdown — opens downward */}
                    {bwOpen && (
                      <div
                        className="absolute left-0 right-0 z-50 rounded-xl border border-border overflow-hidden"
                        style={{
                          top: "calc(100% + 6px)",
                          background: "#ffffff",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                          maxHeight: "280px",
                          overflowY: "auto",
                        }}
                      >
                        {(() => {
                          const q = bwInputVal.toLowerCase().trim();
                          const grouped = new Map<BranchKey, typeof EXERCISE_CATEGORIES>();
                          for (const cat of EXERCISE_CATEGORIES) {
                            if (!grouped.has(cat.branch)) grouped.set(cat.branch, []);
                            grouped.get(cat.branch)!.push(cat);
                          }
                          const branchOrder: BranchKey[] = ["PUSH", "PULL", "CORE", "LEGS"];
                          let anyResults = false;
                          const sections = branchOrder.map(branch => {
                            const cats = grouped.get(branch);
                            if (!cats) return null;
                            const branchColor = cats[0].color;
                            const catSections = cats.map(cat => {
                              const items = (cat.exercises
                                .map(entry => { const dbEx = exercises?.find(e => e.name === entry.dbName); return dbEx ? { ...entry, id: dbEx.id } : null; })
                                .filter(Boolean) as Array<ExerciseEntry & { id: number }>)
                                .filter(item => !q || item.label.toLowerCase().includes(q) || item.dbName.toLowerCase().includes(q));
                              if (!items.length) return null;
                              anyResults = true;
                              const subLabel = cat.label.replace(/^(Push|Pull|Core|Legs)\s*[—-]\s*/i, "");
                              return (
                                <div key={cat.label}>
                                  {!q && (
                                    <div className="px-3 py-1 text-[8.5px] font-bold uppercase tracking-widest border-b"
                                      style={{ color: `${branchColor}`, borderColor: "rgba(0,0,0,0.06)", background: `${branchColor}10` }}>
                                      {subLabel}
                                    </div>
                                  )}
                                  {items.map(item => <BwRow key={item.id} item={item} branchColor={branchColor} />)}
                                </div>
                              );
                            }).filter(Boolean);
                            if (!catSections.length) return null;
                            return (
                              <div key={branch}>
                                {!q && (
                                  <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] sticky top-0 z-10 border-b"
                                    style={{ background: `${branchColor}22`, borderColor: `${branchColor}44`, color: branchColor }}>
                                    {branch}
                                  </div>
                                )}
                                {catSections}
                              </div>
                            );
                          });
                          if (!anyResults && q) return <div className="py-6 text-center text-xs text-muted-foreground">{t("workout.noExercisesFound", { query: bwInputVal })}</div>;
                          return <>{sections}</>;
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                {/* ══ RIGHT: Equipment Specialty ══════════════════════════════ */}
                {/* No backdropFilter — avoids nested stacking context that clips the dropdown */}
                <div
                  className="rounded-2xl border border-border p-3 flex flex-col gap-2 bg-white"
                  style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}
                >
                  <div className="flex items-center gap-1.5">
                    <Dumbbell className="w-3 h-3 text-primary/70 shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-primary/80">{t("workout.equipmentLabel")}</span>
                  </div>

                  {/* EQ Combobox */}
                  <div className="relative">
                    {/* Input */}
                    <div className="relative flex items-center">
                      <Search className="absolute left-2.5 w-3 h-3 text-muted-foreground pointer-events-none shrink-0" />
                      <input
                        ref={eqInputRef}
                        disabled={isModelLoading}
                        value={eqOpen ? eqInputVal : (eqSelectedLabel ?? "")}
                        placeholder={isModelLoading ? t("workout.loadingModel") : t("workout.searchEquipmentPlaceholder")}
                        autoComplete="off"
                        className="w-full pl-7 pr-7 py-2.5 text-xs font-semibold bg-muted/50 border border-border rounded-xl outline-none transition-colors placeholder:text-muted-foreground placeholder:font-normal disabled:opacity-40 truncate"
                        style={eqOpen ? { borderColor: "rgba(23,117,72,0.4)" } : undefined}
                        onFocus={() => { setEqOpen(true); setEqInputVal(""); setBwOpen(false); }}
                        onChange={e => { setEqInputVal(e.target.value); }}
                        onBlur={() => { setTimeout(() => setEqOpen(false), 150); }}
                      />
                      <button
                        className="absolute right-2 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                        onMouseDown={e => {
                          e.preventDefault();
                          if (eqOpen) { setEqOpen(false); }
                          else { setEqInputVal(""); setEqOpen(true); setBwOpen(false); eqInputRef.current?.focus(); }
                        }}
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${eqOpen ? "rotate-180" : ""}`} />
                      </button>
                    </div>

                    {/* Floating dropdown — opens downward */}
                    {eqOpen && (
                      <div
                        className="absolute left-0 right-0 z-50 rounded-xl border border-border overflow-hidden"
                        style={{
                          top: "calc(100% + 6px)",
                          background: "#ffffff",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                          maxHeight: "280px",
                          overflowY: "auto",
                        }}
                      >
                        {(() => {
                          const q = eqInputVal.toLowerCase().trim();
                          const branchMeta: Record<EquipmentBranchKey, { label: string; color: string }> = {
                            BAR:      { label: t("workout.barSpecialist"), color: "#b45309" },
                            RINGS:    { label: t("workout.rings"),    color: "#0891b2" },
                            WEIGHTED: { label: t("workout.weighted"), color: "#177548" },
                          };
                          let anyResults = false;
                          const sections = (["BAR", "RINGS", "WEIGHTED"] as EquipmentBranchKey[]).map(branch => {
                            const cats = EQUIPMENT_SPECIALTY_CATEGORIES.filter(c => c.branch === branch);
                            if (!cats.length) return null;
                            const { label: branchLabel, color: branchColor } = branchMeta[branch];
                            const items = cats.flatMap(cat =>
                              (cat.exercises
                                .map(entry => { const dbEx = exercises?.find(e => e.name === entry.dbName); return dbEx ? { ...entry, id: dbEx.id } : null; })
                                .filter(Boolean) as Array<{ dbName: string; label: string; nodeId: string | null; id: number }>)
                                .filter(item => !q || item.label.toLowerCase().includes(q) || item.dbName.toLowerCase().includes(q))
                            );
                            if (!items.length) return null;
                            anyResults = true;
                            return (
                              <div key={branch}>
                                <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] sticky top-0 z-10 border-b"
                                  style={{ background: `${branchColor}22`, borderColor: `${branchColor}44`, color: branchColor }}>
                                  {branchLabel}
                                </div>
                                {items.map((item, idx) => {
                                  const locked = isExerciseLocked(item.nodeId);
                                  const isSelected = item.id.toString() === selectedExerciseId;
                                  return (
                                    <div key={`${item.id}-${item.nodeId ?? idx}`}>
                                      {idx > 0 && (
                                        <div className="flex justify-center py-0.5">
                                          <div className="w-px h-3" style={{ background: `repeating-linear-gradient(to bottom,${branchColor}80 0,${branchColor}80 3px,transparent 3px,transparent 6px)` }} />
                                        </div>
                                      )}
                                      <div
                                        className={`flex items-center gap-1 border-b border-border/20 group transition-colors ${isSelected ? "" : "hover:bg-muted/60"}`}
                                        style={isSelected ? { background: `${branchColor}20` } : undefined}
                                      >
                                        <button
                                          className="flex-1 text-left text-xs px-3 py-2.5 flex items-center gap-1.5 cursor-pointer"
                                          style={isSelected ? { color: branchColor, fontWeight: 600 } : undefined}
                                          onMouseDown={e => e.preventDefault()}
                                          onClick={() => {
                                            setSelectedExerciseId(item.id.toString());
                                            setEqOpen(false);
                                            setEqInputVal(item.label);
                                            setBwInputVal("");
                                          }}
                                        >
                                          <span className="flex-1 truncate">{item.label}</span>
                                        </button>
                                        <button
                                          className="p-1.5 mr-1 rounded opacity-0 group-hover:opacity-100 hover:bg-black/5 text-muted-foreground hover:text-foreground transition-all shrink-0"
                                          onMouseDown={e => e.preventDefault()}
                                          onClick={e => { e.stopPropagation(); setInfoExercise({ name: item.dbName, id: item.id, nodeId: item.nodeId }); }}
                                        >
                                          <Info className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          });
                          if (!anyResults && q) return <div className="py-6 text-center text-xs text-muted-foreground">{t("workout.noExercisesFound", { query: eqInputVal })}</div>;
                          return <>{sections}</>;
                        })()}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            );
          })()}

          {/* ── Sets & Voice card ────────────────────────────────────────── */}
          <div
            className="rounded-2xl border border-border p-4 space-y-4 bg-white"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}
          >
            {/* Sets picker */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5 flex items-center gap-1.5">
                <Layers className="w-3 h-3" />
                {t("workout.setsLabel")}
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setTotalSets(n)}
                    className={[
                      "flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all",
                      totalSets === n
                        ? "bg-primary/15 border-primary/50 text-primary"
                        : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
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
                <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-primary/70" />
                  {t("workout.voiceCommands")}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  "start" · "end set" · "end workout"
                </div>
              </div>
              <button
                onClick={() => setVoiceCommandsEnabled(!voiceCommandsEnabled)}
                className={[
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                  voiceCommandsEnabled ? "bg-primary" : "bg-muted",
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
              className="rounded-2xl border border-border p-5 space-y-5 bg-white"
              style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setIsManualLog(false); setManualReps(10); setManualRpe(null); }}
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-lg font-bold leading-tight">{t("workout.manualLogTitle")}</h2>
                  <p className="text-xs text-muted-foreground">
                    {exercises?.find(e => e.id.toString() === selectedExerciseId)?.name ?? "Select exercise above"}
                  </p>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">{t("workout.repsCompleted")}</div>
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={() => setManualReps(r => Math.max(0, r - 1))}
                    className="w-12 h-12 rounded-full bg-muted hover:bg-muted/70 border border-border flex items-center justify-center transition-all active:scale-95"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <div className="text-6xl font-black font-mono text-primary w-24 text-center tabular-nums">
                    {manualReps}
                  </div>
                  <button
                    onClick={() => setManualReps(r => r + 1)}
                    className="w-12 h-12 rounded-full bg-muted hover:bg-muted/70 border border-border flex items-center justify-center transition-all active:scale-95"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex justify-between">
                  <span>{t("workout.rpeLabel")}</span>
                  {manualRpe && <span className="text-primary">{manualRpe}/10</span>}
                </div>
                <div className="flex gap-1.5 justify-center flex-wrap">
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button
                      key={n}
                      onClick={() => setManualRpe(prev => prev === n ? null : n)}
                      className={`w-9 h-9 rounded-full text-sm font-bold transition-all active:scale-95 ${
                        manualRpe === n
                          ? "bg-primary text-white border-2 border-primary"
                          : "bg-muted border border-border text-muted-foreground hover:border-foreground/30"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                  {t("workout.rpeHint")}
                </p>
              </div>

              <Button
                size="lg"
                className="w-full h-12 text-base font-bold rounded-xl"
                onClick={handleManualLog}
                disabled={!selectedExerciseId || isSavingManual}
              >
                <PenLine className="w-4 h-4 mr-2" />
                {isSavingManual ? t("workout.saving") : t("workout.logIt")}
              </Button>
            </div>

          ) : (
            /* ── Ready to Train card ─────────────────────────────────────── */
            <div
              className="rounded-2xl border border-border p-5 space-y-5 bg-white"
              style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}
            >
              {/* ── Animation preview or static heading ── */}
              {(() => {
                const ex = exercises?.find(e => e.id.toString() === selectedExerciseId);
                if (ex) {
                  return (
                    <div className="flex flex-col items-center gap-3">
                      <div
                        className="rounded-xl overflow-hidden"
                        style={{
                          background: "#f8fafc",
                          boxShadow: "inset 0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(23,117,72,0.12)",
                          border: "1px solid rgba(23,117,72,0.15)",
                        }}
                      >
                        <ExerciseAnimation exerciseName={ex.name} size={200} />
                      </div>
                      <div className="text-center">
                        <h2 className="text-base font-bold leading-snug">{ex.name}</h2>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                          {t("workout.ghostSkeletonDesc")}
                        </p>
                      </div>
                    </div>
                  );
                }
                return (
                  <div>
                    <h2 className="text-lg font-bold mb-1">{t("workout.readyToTrain")}</h2>
                    <p className="text-sm text-muted-foreground leading-snug">
                      {t("workout.ghostSkeletonDesc")}
                    </p>
                  </div>
                );
              })()}

              {/* How to Perform */}
              {(() => {
                const ex = exercises?.find(e => e.id.toString() === selectedExerciseId);
                if (!ex) return null;
                const config = getExerciseConfig(ex.name);
                const cues = config?.criticalJoints ?? [];
                const extraCues = (ex.coachingCues ?? []).slice(1);
                if (cues.length === 0 && extraCues.length === 0) return null;
                return (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <Dumbbell className="w-3 h-3" />
                      How to perform
                    </div>
                    <ol className="space-y-2">
                      {cues.map((joint, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span
                            className="shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                            style={{ background: "#177548", border: "1px solid rgba(23,117,72,0.4)" }}
                          >
                            {i + 1}
                          </span>
                          <div>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{joint.label} — </span>
                            <span className="text-xs text-foreground/80 leading-snug">{joint.description}</span>
                          </div>
                        </li>
                      ))}
                      {extraCues.map((cue, i) => (
                        <li key={`cue-${i}`} className="flex items-start gap-2.5">
                          <span
                            className="shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white/80"
                            style={{ background: "rgba(23,117,72,0.75)", border: "1px solid rgba(23,117,72,0.3)" }}
                          >
                            {cues.length + i + 1}
                          </span>
                          <p className="text-xs text-foreground/70 leading-snug">{cue}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })()}

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
                      <div className="text-[9px] font-bold uppercase tracking-widest text-primary/60 mb-0.5">{t("workout.proTip")}</div>
                      <p className="text-xs text-foreground/75 leading-snug">{tip}</p>
                    </div>
                  </div>
                );
              })()}

              {/* ── Tiered action rows ───────────────────────────────────── */}
              <div className="space-y-0 divide-y divide-black/[0.06] rounded-2xl border border-black/[0.08] overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

                {/* ROW 1 — Live Feedback (Pro) */}
                <div
                  className="relative px-4 py-4 space-y-3 bg-white overflow-hidden"
                  onClick={!isPro ? () => setShowCameraPaywall(true) : undefined}
                  style={!isPro ? { cursor: "pointer" } : undefined}
                >
                  {/* Content — always rendered; blurred behind overlay for free users */}
                  <div className={!isPro ? "pointer-events-none select-none" : undefined}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-black flex items-center gap-1.5"><EmojiIcon emoji="⚡" className="w-4 h-4 object-contain shrink-0" /> Train with Live Feedback</span>
                    </div>
                    <button
                      onClick={isPro ? handleStart : undefined}
                      disabled={!selectedExerciseId || isModelLoading}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                      style={{ background: "#177548", boxShadow: "0 3px 14px rgba(23,117,72,0.28)" }}
                    >
                      <Play className="w-4 h-4 fill-current" />
                      {isModelLoading ? t("workout.loadingModel") : "Start Session"}
                    </button>
                  </div>

                  {/* Frosted glass overlay — free tier only */}
                  {!isPro && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        backdropFilter: "blur(5px)",
                        WebkitBackdropFilter: "blur(5px)",
                        background: "rgba(255,255,255,0.55)",
                      }}
                    >
                      <span
                        className="text-[11px] font-black uppercase tracking-[0.18em] px-3 py-1.5 rounded-lg"
                        style={{
                          background: "rgba(255,255,255,0.85)",
                          color: "#000000",
                          border: "1.5px solid #000000",
                          boxShadow: "0 1px 6px rgba(0,0,0,0.10)",
                        }}
                      >
                        <EmojiIcon emoji="⚡" className="w-3.5 h-3.5 object-contain shrink-0 inline-block align-middle mr-1" /> Pro Feature
                      </span>
                    </div>
                  )}
                </div>

                {/* ROW 2 — Manual (free) */}
                <div className="px-4 py-4 space-y-3 bg-white">
                  <span className="text-sm font-bold text-black flex items-center gap-1.5"><EmojiIcon emoji="📝" className="w-4 h-4 object-contain shrink-0" /> Train Without Live Feedback</span>
                  <button
                    onClick={() => { setIsManualLog(true); setManualReps(10); setManualRpe(null); }}
                    disabled={!selectedExerciseId}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-35 disabled:cursor-not-allowed hover:bg-black/[0.03]"
                    style={{ background: "#ffffff", border: "1.5px solid rgba(0,0,0,0.18)", color: "#000000" }}
                  >
                    <PenLine className="w-4 h-4" />
                    Start Manual Log
                  </button>
                </div>

                {/* ROW 3 — Warmup (free, requires exercise selection) */}
                {(() => {
                  const selEx = exercises?.find(e => e.id.toString() === selectedExerciseId);
                  const disabled = !selectedExerciseId || isModelLoading;
                  return (
                    <div className="px-4 py-4 space-y-3 bg-white">
                      <span className="text-sm font-bold text-black flex items-center gap-1.5"><EmojiIcon emoji="🤸" className="w-4 h-4 object-contain shrink-0" /> Targeted Warmup Routine</span>
                      <button
                        disabled={disabled}
                        onClick={() => setWarmupExerciseName(selEx?.name ?? "")}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-35 disabled:cursor-not-allowed hover:bg-black/[0.03]"
                        style={{ background: "#ffffff", border: "1.5px solid rgba(0,0,0,0.18)", color: "#000000" }}
                      >
                        <Sparkles className="w-4 h-4" style={{ color: disabled ? "inherit" : "#177548" }} />
                        Start Warmup
                      </button>
                    </div>
                  );
                })()}

              </div>
            </div>
          )}

        </div>
      )}

      {/* ── Contextual Warmup Modal ──────────────────────────────────── */}
      {warmupExerciseName !== null && (() => {
        const stretches = buildWarmupSequence([], warmupExerciseName);
        return stretches.length > 0 ? (
          <WorkoutWarmupModal
            stretches={stretches}
            onClose={() => setWarmupExerciseName(null)}
          />
        ) : null;
      })()}
    </div>
  );
}

// Suppress unused import warning — EvaluatedSkill is re-exported via SessionResultsProps types
void (undefined as unknown as EvaluatedSkill);
void (undefined as unknown as typeof SYNC_VOICE_THRESHOLD);
