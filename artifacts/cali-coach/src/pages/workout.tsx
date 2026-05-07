import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { useListExercises, useListSessions, useCreateSession, useUpdateSession, useCreateRep, useGetCalibration } from "@workspace/api-client-react";
import { FilesetResolver, PoseLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Activity, Play, Square, FlaskConical, Ghost, Settings2, ChevronDown, ChevronRight, Info, Crosshair, Zap, Eye, EyeOff, Mic, MicOff, PenLine, ChevronLeft, Plus, Minus, Timer, SkipForward, Layers, Lock, Ruler, Search, Dumbbell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getExerciseConfig, type Phase, type Landmark, type EquipmentContext } from "@/lib/exercise-registry";
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
  // Exercise picker search query — resets on picker close
  const [exerciseSearch, setExerciseSearch] = useState("");
  // Equipment picker open state (independent from bodyweight picker)
  const [eqPickerOpen, setEqPickerOpen] = useState(false);
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
  const voiceStateRef = useRef({ isResting: false, isWorkoutActive: false, isCameraInitializing: false });

  // Stable refs to the latest handler versions (avoids stale closures in voice)
  const handleEndSetRef       = useRef<() => Promise<void>>(async () => {});
  const handleStartNextSetRef = useRef<() => void>(() => {});
  const handleStopRef         = useRef<() => Promise<void>>(async () => {});
  const handleStartRef        = useRef<() => Promise<void>>(async () => {});
  /** Guards against double-firing End Workout (button + voice command race). */
  const isEndingRef           = useRef(false);

  // ── Equipment selection ────────────────────────────────────────────────────
  const [equipment, setEquipment] = useState<EquipmentSelection>(DEFAULT_EQUIPMENT);

  // ── Camera-init state (1-second ramp before workout goes live) ─────────────
  const [isCameraInitializing, setIsCameraInitializing] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const landmarkerRef      = useRef<PoseLandmarker | null>(null);
  const requestRef         = useRef<number>(0);
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

  // ── Audio-cue priority buffer (150 ms debounce window) ───────────────────
  /** Highest-priority cue collected in the current 150 ms window. */
  const pendingFormCueRef = useRef<{ text: string; tone: "encouraging" | "firm" | "neutral"; priority: number } | null>(null);
  /** setTimeout ID for flushing the pending form cue. */
  const cueFlushTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── "Stay in frame" cue cooldown ─────────────────────────────────────────
  /** Date.now() of the last "stay in frame" voice cue — 8 s cooldown. */
  const lastInFrameCueMsRef = useRef(0);

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

  /**
   * Priority-buffered form-correction cue.
   *
   * During fast reps the exercise state machine can fire multiple audioCues
   * within a single rep cycle.  This function collects cues for a 150 ms
   * window and speaks only the highest-priority one — preventing the coach
   * from shouting three corrections at once.
   *
   * Priority levels:
   *   3 = critical   (blendedScore < 60)
   *   2 = moderate   (blendedScore < 80)
   *   1 = general
   */
  const speakFormCue = useCallback((
    text:     string,
    tone:     "encouraging" | "firm" | "neutral",
    priority: number,
  ) => {
    const cur = pendingFormCueRef.current;
    // Replace with the incoming cue only if it is at least as important
    if (!cur || priority >= cur.priority) {
      pendingFormCueRef.current = { text, tone, priority };
    }
    // Schedule the flush if not already pending
    if (!cueFlushTimerRef.current) {
      cueFlushTimerRef.current = setTimeout(() => {
        cueFlushTimerRef.current = null;
        const cue = pendingFormCueRef.current;
        pendingFormCueRef.current = null;
        if (cue) speak(cue.text, cue.tone);
      }, 150);
    }
  }, [speak]);

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
        equipCue = "Steady the rings — control the swing.";
      }
    }
    if (isPushExercise(exercise.name) && equipment.pushGear === "floor" && equipModRef.current.wristOverextended) {
      equipCue = "Neutral wrists — don't let them bend back.";
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
            const t = setTimeout(() => { voiceSpeak(cue.text, cue.tone); }, cue.delayMs);
            pacerTimeoutsRef.current.push(t);
          });
        } else if (isAscending) {
          voiceSpeak(ASCEND_PACER_CUE.text, ASCEND_PACER_CUE.tone);
        }
      } else {
        // ── Standard phase-transition cue ─────────────────────────────────
        const phaseCue = getPhaseTransitionCue(exercise.name, prevPhase, output.newPhase);
        if (phaseCue) {
          speakPhase(phaseCue.text, phaseCue.tone);
        }
      }
    }

    if (output.isStatic) {
      const holdNow = output.isHoldActive === true && synced;

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
        if (synced) {
          speak(output.audioCue ?? "Adjust your position.", tone);
        }
      }

      stateRef.current.holdActive     = holdNow;
      stateRef.current.lastHoldTickMs = holdNow ? now : 0;
      setIsInActiveZone(holdNow);

      stateRef.current.repFormScores.push(blendedScore);
      setFormScore(prev => prev * 0.9 + blendedScore * 0.1);
    } else {
      const { repCounted, repQuality, audioCue } = output;

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
        // Form correction — priority-buffer (150 ms window) speaks only the
        // most critical cue per burst, preventing rapid-fire corrections.
        const priority = blendedScore < 60 ? 3 : blendedScore < 80 ? 2 : 1;
        speakFormCue(audioCue, tone, priority);
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

        // ── Visibility / "stay in frame" coaching ────────────────────────
        // Key landmarks: shoulders (11,12), elbows (13,14), wrists (15,16),
        // hips (23,24).  If ≥4 of these drop below 0.5 visibility the user
        // is likely out of frame or in poor lighting.  One gentle cue fires
        // at most every 8 seconds so it never drowns out form coaching.
        if (stateRef.current.sessionId !== 0) {
          const KEY_LM_INDICES = [11, 12, 13, 14, 15, 16, 23, 24];
          const lowVisCount = KEY_LM_INDICES.filter(
            idx => (raw[idx]?.visibility ?? 1) < 0.5,
          ).length;
          const nowMs = Date.now();
          if (lowVisCount >= 4 && nowMs - lastInFrameCueMsRef.current > 8000) {
            lastInFrameCueMsRef.current = nowMs;
            const inFrameCues = [
              "Try to stay in frame.",
              "Step back so your full body is visible.",
              "Check your lighting — I'm losing track.",
            ];
            voiceSpeak(
              inFrameCues[Math.floor(Math.random() * inFrameCues.length)],
              "neutral",
            );
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

    // Immediately silence TTS and stop the mic so neither stays active
    // during the async save / navigation transition.
    cancelSpeech();
    voiceCommandsEnabledRef.current = false;
    try { speechRecognitionRef.current?.stop(); } catch {}
    speechRecognitionRef.current = null;
    setIsListening(false);

    setIsWorkoutActive(false);
    setIsCameraInitializing(false);
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
      const sessionResult = await updateSession.mutateAsync({
        id:   finalSessionId,
        data: {
          completedAt:  new Date().toISOString(),
          totalReps:    finalReps,
          avgFormScore: finalFormScore,
          ...(frozenDetectedRef.current ? { isVerified: false } : {}),
        },
      }) as unknown as {
        newBadges?: Array<{ id: string; name: string; icon: string; category: string; tier: string }>;
        newExerciseTiers?: Array<{ exerciseName: string; tier: string; title: string; icon: string }>;
      };

      // Show milestone badge toasts for newly earned category badges
      const milestones = sessionResult?.newBadges ?? [];
      for (const badge of milestones) {
        setTimeout(() => {
          toast({
            title: `🏅 Milestone Unlocked: ${badge.name}`,
            description: `${badge.icon} You've earned the ${badge.tier} badge for ${badge.category} volume!`,
          });
        }, 800);
      }

      // Show mastery tier toasts for newly earned per-exercise titles
      const exerciseTiers = sessionResult?.newExerciseTiers ?? [];
      for (const et of exerciseTiers) {
        setTimeout(() => {
          toast({
            title: `${et.icon} New Title: "${et.title}"`,
            description: `${et.exerciseName} · ${et.tier} mastery unlocked!`,
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

          {/* Camera-initializing spinner */}
          {isCameraInitializing && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none select-none">
              <div
                className="px-6 py-5 rounded-2xl text-center backdrop-blur-sm flex flex-col items-center gap-3"
                style={{ background: "rgba(0,0,0,0.72)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-sm font-semibold text-white/90">Camera Initializing…</p>
              </div>
            </div>
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
            className="rounded-2xl border border-white/10 p-4 space-y-3"
            style={{
              background: "linear-gradient(135deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0.02) 100%)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            {/* Column headers */}
            <div className="flex gap-3">
              <div className={`text-[10px] font-bold uppercase tracking-widest text-white/35 ${equipmentLensOn ? "flex-1" : "w-full"}`}>
                Exercise
              </div>
              {equipmentLensOn && (
                <div className="flex-1 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#f59e0b99" }}>
                  <svg width="9" height="9" viewBox="0 0 9 9"><polygon points="4.5,0 9,4.5 4.5,9 0,4.5" fill="#f59e0b" /></svg>
                  With Equipment
                </div>
              )}
            </div>

            {/* Shared search bar — filters both dropdowns simultaneously */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
              <input
                value={exerciseSearch}
                onChange={e => setExerciseSearch(e.target.value)}
                placeholder="Search exercises…"
                className="w-full pl-8 pr-3 py-2 text-sm bg-white/[0.05] border border-white/10 rounded-lg outline-none focus:border-primary/40 placeholder:text-white/25 transition-colors"
                autoComplete="off"
              />
            </div>

            {/* Dropdown triggers (side-by-side when equipment lens is on) */}
            <div className="flex gap-2">
              {/* Left: Bodyweight exercises */}
              <div className={equipmentLensOn ? "flex-1 min-w-0" : "w-full"}>
                <Popover
                  open={pickerOpen}
                  onOpenChange={open => {
                    setPickerOpen(open);
                    if (!open) setExerciseSearch("");
                    if (open) setEqPickerOpen(false);
                  }}
                >
                  <PopoverTrigger asChild>
                    <button
                      disabled={isModelLoading}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.09] transition-colors disabled:opacity-40"
                    >
                      <span className="flex-1 text-left font-semibold text-sm truncate">
                        {isModelLoading ? "Loading model…" : (() => {
                          for (const cat of EXERCISE_CATEGORIES) {
                            const entry = cat.exercises.find(e => exercises?.find(ex => ex.name === e.dbName)?.id.toString() === selectedExerciseId);
                            if (entry) return entry.label;
                          }
                          return "Select exercise…";
                        })()}
                      </span>
                      <ChevronDown className="w-4 h-4 shrink-0 text-white/35" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="p-0 overflow-hidden"
                    style={{ width: equipmentLensOn ? "min(310px, calc(50vw - 2rem))" : "min(480px, calc(100vw - 1.5rem))" }}
                    align="start"
                    side="top"
                    sideOffset={6}
                  >
                    <div style={{ maxHeight: "min(440px, calc(100vh - 160px))", overflowY: "auto" }}>
                      {(() => {
                        const q = exerciseSearch.toLowerCase().trim();
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
                              .map(entry => {
                                const dbEx = exercises?.find(e => e.name === entry.dbName);
                                return dbEx ? { ...entry, id: dbEx.id } : null;
                              })
                              .filter(Boolean) as Array<ExerciseEntry & { id: number }>)
                              .filter(item => !q || item.label.toLowerCase().includes(q) || item.dbName.toLowerCase().includes(q));
                            if (items.length === 0) return null;
                            anyResults = true;
                            const subLabel = cat.label.replace(/^(Push|Pull|Core|Legs)\s*[—-]\s*/i, "");
                            return (
                              <div key={cat.label}>
                                {!q && (
                                  <div className="px-3 py-1 text-[8.5px] font-bold uppercase tracking-widest border-b"
                                    style={{ color: `${branchColor}80`, borderColor: "rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}>
                                    {subLabel}
                                  </div>
                                )}
                                {items.map(item => {
                                  const locked = isExerciseLocked(item.nodeId);
                                  const isSelected = item.id.toString() === selectedExerciseId;
                                  return (
                                    <div key={item.id}
                                      className={`flex items-center gap-1 border-b border-border/20 group transition-colors ${isSelected ? "" : locked ? "opacity-50 hover:opacity-70" : "hover:bg-white/[0.04]"}`}
                                      style={isSelected ? { background: `${branchColor}20` } : undefined}>
                                      <button className="flex-1 text-left text-xs px-3 py-2 truncate flex items-center gap-1.5 cursor-pointer"
                                        style={isSelected ? { color: branchColor, fontWeight: 600 } : undefined}
                                        onClick={() => {
                                          if (locked) { setPickerOpen(false); setInfoExercise({ name: item.dbName, id: item.id, nodeId: item.nodeId }); }
                                          else { setSelectedExerciseId(item.id.toString()); setPickerOpen(false); setExerciseSearch(""); }
                                        }}>
                                        {locked && <Lock className="w-2.5 h-2.5 shrink-0 text-white/30" />}
                                        <span className="truncate">{item.label}</span>
                                      </button>
                                      <button className="p-1.5 mr-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all shrink-0"
                                        onClick={e => { e.stopPropagation(); setInfoExercise({ name: item.dbName, id: item.id, nodeId: item.nodeId }); }}>
                                        {locked ? <Lock className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }).filter(Boolean);
                          if (catSections.length === 0) return null;
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
                        if (!anyResults && q) return <div className="py-8 text-center text-sm text-white/35">No matches for "{exerciseSearch}"</div>;
                        return <>{sections}</>;
                      })()}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Right: Equipment specialty (only shown when Equipment Lens is on) */}
              {equipmentLensOn && (
                <div className="flex-1 min-w-0">
                  <Popover
                    open={eqPickerOpen}
                    onOpenChange={open => {
                      setEqPickerOpen(open);
                      if (!open) setExerciseSearch("");
                      if (open) setPickerOpen(false);
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        disabled={isModelLoading}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors disabled:opacity-40"
                        style={{ background: "rgba(245,158,11,0.05)", borderColor: "#f59e0b35" }}
                      >
                        <span className="flex-1 text-left font-semibold text-sm truncate">
                          {isModelLoading ? "Loading model…" : (() => {
                            for (const cat of EQUIPMENT_SPECIALTY_CATEGORIES) {
                              const entry = cat.exercises.find(e => exercises?.find(ex => ex.name === e.dbName)?.id.toString() === selectedExerciseId);
                              if (entry) return entry.label;
                            }
                            return "Select equipment…";
                          })()}
                        </span>
                        <ChevronDown className="w-4 h-4 shrink-0 opacity-40" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="p-0 overflow-hidden"
                      style={{ width: "min(310px, calc(50vw - 2rem))" }}
                      align="start"
                      side="top"
                      sideOffset={6}
                    >
                      <div style={{ maxHeight: "min(440px, calc(100vh - 160px))", overflowY: "auto" }}>
                        {(() => {
                          const q = exerciseSearch.toLowerCase().trim();
                          const branchMeta: Record<EquipmentBranchKey, { label: string; color: string }> = {
                            BAR:      { label: "Bar Specialist", color: "#f59e0b" },
                            RINGS:    { label: "Rings",          color: "#06b6d4" },
                            WEIGHTED: { label: "Weighted",       color: "#a855f7" },
                          };
                          let anyResults = false;
                          const sections = (["BAR", "RINGS", "WEIGHTED"] as EquipmentBranchKey[]).map(branch => {
                            const cats = EQUIPMENT_SPECIALTY_CATEGORIES.filter(c => c.branch === branch);
                            if (!cats.length) return null;
                            const { label: branchLabel, color: branchColor } = branchMeta[branch];
                            const items = cats.flatMap(cat =>
                              (cat.exercises
                                .map(entry => {
                                  const dbEx = exercises?.find(e => e.name === entry.dbName);
                                  return dbEx ? { ...entry, id: dbEx.id } : null;
                                })
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
                                      <div className={`flex items-center gap-1 border-b border-border/20 group transition-colors ${isSelected ? "" : locked ? "opacity-50 hover:opacity-70" : "hover:bg-white/[0.04]"}`}
                                        style={isSelected ? { background: `${branchColor}20` } : undefined}>
                                        <button className="flex-1 text-left text-xs px-3 py-2 flex items-center gap-1.5 cursor-pointer"
                                          style={isSelected ? { color: branchColor, fontWeight: 600 } : undefined}
                                          onClick={() => {
                                            if (locked) { setEqPickerOpen(false); setInfoExercise({ name: item.dbName, id: item.id, nodeId: item.nodeId }); }
                                            else { setSelectedExerciseId(item.id.toString()); setEqPickerOpen(false); setExerciseSearch(""); }
                                          }}>
                                          {locked && <Lock className="w-2.5 h-2.5 shrink-0 text-white/30" />}
                                          <span className="flex-1 truncate">{item.label}</span>
                                        </button>
                                        <button className="p-1.5 mr-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all shrink-0"
                                          onClick={e => { e.stopPropagation(); setInfoExercise({ name: item.dbName, id: item.id, nodeId: item.nodeId }); }}>
                                          {locked ? <Lock className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          });
                          if (!anyResults && q) return <div className="py-8 text-center text-sm text-white/35">No matches for "{exerciseSearch}"</div>;
                          return <>{sections}</>;
                        })()}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
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
