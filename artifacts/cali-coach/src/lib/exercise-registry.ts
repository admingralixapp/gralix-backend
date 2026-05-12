/**
 * ExerciseRegistry
 *
 * Single source of truth for:
 *   - Which joints are "Critical" for each movement
 *   - The per-exercise rep-counting state machine (standard/explosive)
 *   - The static Hold Timer logic for isometric exercises
 *   - Form scoring and audio cue logic
 *
 * All landmark indices follow the MediaPipe Pose 33-keypoint model.
 * https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 *
 * STATIC exercises:
 *   - processFrame always returns repCounted=false and isHoldActive=true|false
 *   - isHoldActive = true when ALL key angles are within ±10° of perfect position
 *   - The workout page runs the Hold Timer only while isHoldActive is true
 *   - totalReps saved to DB represents seconds held (integer)
 */

import { pickFormCue } from "./form-cues";

// ─── MediaPipe landmark indices ───────────────────────────────────────────────
export const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,     RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,     RIGHT_WRIST: 16,
  LEFT_HIP: 23,       RIGHT_HIP: 24,
  LEFT_KNEE: 25,      RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,     RIGHT_ANKLE: 28,
} as const;

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/**
 * Phase names used by each exercise's rep state machine.
 *
 *  "up"     — top/starting position (push-up, squat, lunge, dip, burpee)
 *  "down"   — bottom of the movement
 *  "top"    — chin-over-bar position (pull-up)
 *  "bottom" — dead-hang position (pull-up)
 *  "hold"   — static hold (plank, front lever, dragon flag, human flag)
 */
export type Phase = "up" | "down" | "top" | "bottom" | "hold";

export type RepQuality = "complete" | "incomplete";

export interface FrameResult {
  newPhase: Phase;
  repCounted: boolean;
  repQuality: RepQuality | null;
  /** 0–100 form quality score for this frame. */
  formScore: number;
  /** Text to speak immediately, or null for silence. */
  audioCue: string | null;
  /**
   * For STATIC exercises only: true when the user's joint angles are
   * all within ±10° of the perfect hold position (the "Active Zone").
   * The workout Hold Timer ticks only while this is true.
   * Undefined for standard/explosive exercises.
   */
  isHoldActive?: boolean;
}

export interface CriticalJoint {
  label: string;
  description: string;
}

/**
 * Optional equipment context — passed from the workout page to processFrame.
 * Exercises use this to adjust thresholds based on the user's selected gear.
 */
export interface EquipmentContext {
  /**
   * Override elbow angle threshold for rep completion in push / dip exercises.
   * Floor default: 150°.  Low parallettes: 135°.  High parallettes: 120°.
   */
  pushDepthThreshold?: number;
}

export interface ExerciseConfig {
  displayName: string;
  criticalJoints: CriticalJoint[];
  initialPhase: Phase;
  /**
   * true = this exercise uses the Hold Timer UI instead of a rep counter.
   * processFrame will return isHoldActive to drive the timer.
   */
  isStatic: boolean;
  /**
   * Performance scoring weight for leaderboard points.
   * Points per rep (or per second for static holds) = difficultyWeight × (formScore / 100).
   * Tiers: Beginner=1.0, Intermediate=3.0, Advanced=5.0, Elite=10.0
   * Only AI-verified sessions contribute leaderboard points.
   */
  difficultyWeight: number;
  processFrame(landmarks: Landmark[], currentPhase: Phase, equipment?: EquipmentContext): FrameResult;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** 2-D angle (degrees) at vertex b, formed by rays b→a and b→c. */
export function calcAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const rad =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let deg = Math.abs(rad * (180 / Math.PI));
  if (deg > 180) deg = 360 - deg;
  return deg;
}

function midpoint(a: Landmark, b: Landmark): Landmark {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Returns true when `angle` is within `target ± tolerance` degrees.
 * Default tolerance = 10° (as spec'd in the Active Zone requirement).
 */
function inZone(angle: number, target: number, tolerance = 10): boolean {
  return Math.abs(angle - target) <= tolerance;
}

// ─── Push Regressions ─────────────────────────────────────────────────────────

const WALL_PUSH_UP: ExerciseConfig = {
  displayName: "Wall Push-Up",
  isStatic: false,
  difficultyWeight: 1.0,
  criticalJoints: [
    { label: "Shoulder–Elbow–Wrist", description: "Elbow angle drives rep counting. Lock out fully at the top." },
    { label: "Elbow alignment", description: "Keep elbows pointed downward, not flaring wide." },
  ],
  initialPhase: "up",
  processFrame(lm, phase, equipment) {
    const elbowAngle = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "up" && elbowAngle < 100) newPhase = "down";
    else if (phase === "down" && elbowAngle > (equipment?.pushDepthThreshold ?? 155)) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }

    const rightElbow = calcAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]);
    const symmetryPenalty = clamp(Math.abs(rightElbow - elbowAngle) * 0.5, 0, 20);
    const formScore = clamp(100 - symmetryPenalty, 0, 100);
    const audioCue = formScore < 70 ? pickFormCue("Wall Push-Up", "elbows_flaring") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const INCLINE_PUSH_UP: ExerciseConfig = {
  displayName: "Incline Push-Up",
  isStatic: false,
  difficultyWeight: 1.0,
  criticalJoints: [
    { label: "Shoulder–Elbow–Wrist", description: "Elbow angle drives rep counting. Lock out fully at the top." },
    { label: "Shoulder–Hip–Ankle line", description: "Body must stay in a straight plank line throughout." },
  ],
  initialPhase: "up",
  processFrame(lm, phase, equipment) {
    const elbowAngle = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "up" && elbowAngle < 95) newPhase = "down";
    else if (phase === "down" && elbowAngle > (equipment?.pushDepthThreshold ?? 150)) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }

    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const ankleMid = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);
    const bodyAngle = calcAngle(shoulderMid, hipMid, ankleMid);
    const formScore = clamp(100 - Math.max(0, 180 - bodyAngle) * 2.5, 0, 100);
    let audioCue: string | null = null;
    if (formScore < 60) {
      audioCue = hipMid.y < shoulderMid.y
        ? pickFormCue("Incline Push-Up", "hips_too_high")
        : pickFormCue("Incline Push-Up", "hips_sagging");
    }
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const KNEE_PUSH_UP: ExerciseConfig = {
  displayName: "Knee Push-Up",
  isStatic: false,
  difficultyWeight: 1.0,
  criticalJoints: [
    { label: "Shoulder–Elbow–Wrist", description: "Elbow angle drives rep counting. Lock out fully at the top." },
    { label: "Shoulder–Hip–Knee line", description: "Body must stay straight from shoulder to knee — ankles are ignored." },
  ],
  initialPhase: "up",
  processFrame(lm, phase, equipment) {
    const elbowAngle = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "up" && elbowAngle < 90) newPhase = "down";
    else if (phase === "down" && elbowAngle > (equipment?.pushDepthThreshold ?? 150)) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }

    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const kneeMid = midpoint(lm[LM.LEFT_KNEE], lm[LM.RIGHT_KNEE]);
    const bodyAngle = calcAngle(shoulderMid, hipMid, kneeMid);
    const formScore = clamp(100 - Math.max(0, 180 - bodyAngle) * 2.5, 0, 100);
    let audioCue: string | null = null;
    if (formScore < 60) {
      audioCue = hipMid.y < shoulderMid.y
        ? pickFormCue("Knee Push-Up", "hips_too_high")
        : pickFormCue("Knee Push-Up", "hips_sagging");
    }
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// Knee push-up depth uses equipment?.pushDepthThreshold, injected above.

const PUSH_UP: ExerciseConfig = {
  displayName: "Push-Up",
  isStatic: false,
  difficultyWeight: 3.0,
  criticalJoints: [
    { label: "Shoulder–Elbow–Wrist", description: "Elbow angle drives rep counting. Lock out fully at the top." },
    { label: "Shoulder–Hip–Ankle line", description: "Body must stay in a straight plank line throughout." },
  ],
  initialPhase: "up",
  processFrame(lm, phase, equipment) {
    const elbowAngle = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "up" && elbowAngle < 90) newPhase = "down";
    else if (phase === "down" && elbowAngle > (equipment?.pushDepthThreshold ?? 150)) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }

    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid      = midpoint(lm[LM.LEFT_HIP],      lm[LM.RIGHT_HIP]);
    const ankleMid    = midpoint(lm[LM.LEFT_ANKLE],    lm[LM.RIGHT_ANKLE]);

    // Body-line angle: deviation from 180° straight = sag or pike
    const bodyAngle = calcAngle(shoulderMid, hipMid, ankleMid);
    const bodyPenalty = clamp(Math.max(0, 180 - bodyAngle) * 2.5, 0, 60);

    // Elbow flare: horizontal distance between elbow and shoulder (normalised)
    const leftFlare  = Math.abs(lm[LM.LEFT_ELBOW].x  - lm[LM.LEFT_SHOULDER].x);
    const rightFlare = Math.abs(lm[LM.RIGHT_ELBOW].x - lm[LM.RIGHT_SHOULDER].x);
    const flarePenalty = clamp(((leftFlare + rightFlare) / 2) * 100, 0, 40);

    const formScore = clamp(100 - bodyPenalty - flarePenalty * 0.5, 0, 100);

    let audioCue: string | null = null;
    if (formScore < 60) {
      if (flarePenalty > bodyPenalty * 0.6) {
        audioCue = pickFormCue("Push-Up", "elbows_flaring");
      } else if (hipMid.y > ankleMid.y * 0.98) {
        audioCue = pickFormCue("Push-Up", "hips_sagging");
      } else {
        audioCue = pickFormCue("Push-Up", "no_rigid_body");
      }
    }
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const DIAMOND_PUSH_UP: ExerciseConfig = {
  displayName: "Diamond Push-Up",
  isStatic: false,
  difficultyWeight: 3.0,
  criticalJoints: [
    { label: "Shoulder–Elbow–Wrist", description: "Elbow angle drives rep counting. Elbows must track close to the torso." },
    { label: "Shoulder–Hip–Ankle line", description: "Maintain a rigid plank throughout — no hip sagging." },
  ],
  initialPhase: "up",
  processFrame(lm, phase, equipment) {
    const elbowAngle = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "up" && elbowAngle < 90) newPhase = "down";
    else if (phase === "down" && elbowAngle > (equipment?.pushDepthThreshold ?? 150)) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }

    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const ankleMid = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);
    const bodyAngle = calcAngle(shoulderMid, hipMid, ankleMid);
    const elbowFlare = Math.abs(lm[LM.LEFT_ELBOW].x - lm[LM.LEFT_SHOULDER].x) * 100;
    const flarePenalty = clamp(elbowFlare * 0.8, 0, 30);
    const bodyPenalty = clamp(Math.max(0, 180 - bodyAngle) * 2, 0, 40);
    const formScore = clamp(100 - flarePenalty - bodyPenalty, 0, 100);
    let audioCue: string | null = null;
    if (flarePenalty > bodyPenalty && formScore < 65) audioCue = pickFormCue("Diamond Push-Up", "elbows_flaring");
    else if (formScore < 60) audioCue = pickFormCue("Diamond Push-Up", "core_loose");
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── Handstand Push-Up ─────────────────────────────────────────────────────────
// Person is inverted against wall. Wrists are high (small y in normalised coords),
// shoulders hang below. Elbow angle drives rep counting (same direction as push-up).

const HANDSTAND_PUSH_UP: ExerciseConfig = {
  displayName: "Handstand Push-Up",
  isStatic: false,
  difficultyWeight: 10.0,
  criticalJoints: [
    { label: "Wrist–Elbow–Shoulder", description: "Elbow angle drives rep counting (inverted). Full lock-out at the top." },
    { label: "Wrist–Hip vertical", description: "Hips should stay stacked above wrists — no banana arch." },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    // Inverted: elbow angle measured from wrist side
    const elbowAngle = calcAngle(lm[LM.LEFT_WRIST], lm[LM.LEFT_ELBOW], lm[LM.LEFT_SHOULDER]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    // "up" = arms extended (angle > 150°), "down" = head near wall (angle < 90°)
    if (phase === "up" && elbowAngle < 90) newPhase = "down";
    else if (phase === "down" && elbowAngle > 150) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }

    // Form: wrist x vs hip x alignment (no excessive arch)
    const wristMidX = midpoint(lm[LM.LEFT_WRIST], lm[LM.RIGHT_WRIST]).x;
    const hipMidX = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]).x;
    const archPenalty = clamp(Math.abs(wristMidX - hipMidX) * 120, 0, 40);
    const formScore = clamp(100 - archPenalty, 0, 100);
    const audioCue = formScore < 65 ? pickFormCue("Handstand Push-Up", "stack_over_wrists") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── Pull Regressions ─────────────────────────────────────────────────────────

const SCAPULAR_SHRUGS: ExerciseConfig = {
  displayName: "Scapular Shrugs",
  isStatic: false,
  difficultyWeight: 1.0,
  criticalJoints: [
    { label: "Wrist–Shoulder distance", description: "Shoulder elevation relative to the bar. Shrugging up decreases the gap." },
    { label: "Arm straightness", description: "Keep elbows locked straight throughout." },
  ],
  initialPhase: "bottom",
  processFrame(lm, phase) {
    const wristY = (lm[LM.LEFT_WRIST].y + lm[LM.RIGHT_WRIST].y) / 2;
    const shoulderY = (lm[LM.LEFT_SHOULDER].y + lm[LM.RIGHT_SHOULDER].y) / 2;
    const gap = shoulderY - wristY;
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "bottom" && gap < 0.18) newPhase = "top";
    else if (phase === "top" && gap > 0.27) {
      newPhase = "bottom"; repCounted = true; repQuality = "complete";
    }

    const elbowAngle = calcAngle(lm[LM.LEFT_WRIST], lm[LM.LEFT_ELBOW], lm[LM.LEFT_SHOULDER]);
    const bendPenalty = clamp((160 - elbowAngle) * 1.5, 0, 40);
    const formScore = clamp(100 - bendPenalty, 0, 100);
    const audioCue = formScore < 65 ? pickFormCue("Scapular Shrugs", "arms_bent") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const AUSTRALIAN_ROWS: ExerciseConfig = {
  displayName: "Australian Rows",
  isStatic: false,
  difficultyWeight: 3.0,
  criticalJoints: [
    { label: "Wrist–Elbow–Shoulder", description: "Elbow angle drives rep counting — pull until chest reaches bar level." },
    { label: "Body plank alignment", description: "Keep hips up and body rigid." },
  ],
  initialPhase: "bottom",
  processFrame(lm, phase) {
    const elbowAngle = calcAngle(lm[LM.LEFT_WRIST], lm[LM.LEFT_ELBOW], lm[LM.LEFT_SHOULDER]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "bottom" && elbowAngle < 90) newPhase = "top";
    else if (phase === "top" && elbowAngle > 155) {
      newPhase = "bottom"; repCounted = true; repQuality = "complete";
    }

    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const ankleMid = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);
    const bodyAngle = calcAngle(shoulderMid, hipMid, ankleMid);
    const formScore = clamp(100 - Math.max(0, 180 - bodyAngle) * 2.5, 0, 100);
    const audioCue = formScore < 60 ? pickFormCue("Australian Rows", "hips_sagging") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const NEGATIVE_PULL_UPS: ExerciseConfig = {
  displayName: "Negative Pull-Ups",
  isStatic: false,
  difficultyWeight: 1.0,
  criticalJoints: [
    { label: "Wrist y vs Shoulder y", description: "Rep starts when chin is over bar. Lower slowly." },
    { label: "Wrist–Elbow–Shoulder", description: "Rep completes at full arm extension (elbow > 160°)." },
  ],
  initialPhase: "top",
  processFrame(lm, phase) {
    const elbowAngle = calcAngle(lm[LM.LEFT_WRIST], lm[LM.LEFT_ELBOW], lm[LM.LEFT_SHOULDER]);
    const wristY = lm[LM.LEFT_WRIST].y;
    const shoulderY = lm[LM.LEFT_SHOULDER].y;
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "top" && elbowAngle > 160) {
      newPhase = "bottom"; repCounted = true; repQuality = "complete";
    }
    if (phase === "bottom" && wristY > shoulderY) newPhase = "top";

    const hipMidX = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]).x;
    const shMidX = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]).x;
    const swingPenalty = clamp(Math.abs(hipMidX - shMidX) * 100, 0, 30);
    const formScore = clamp(100 - swingPenalty, 0, 100);
    const audioCue = formScore < 65 ? pickFormCue("Negative Pull-Ups", "swinging") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const PULL_UP: ExerciseConfig = {
  displayName: "Pull-Up",
  isStatic: false,
  difficultyWeight: 3.0,
  criticalJoints: [
    { label: "Wrist–Elbow–Shoulder (primary)", description: "Elbow angle must exceed 160° at the bottom for a dead-hang." },
    { label: "Wrist y vs Shoulder y", description: "Rep top recorded only when the body rises enough for chin-over-bar." },
  ],
  initialPhase: "bottom",
  processFrame(lm, phase) {
    const elbowAngle = calcAngle(lm[LM.LEFT_WRIST], lm[LM.LEFT_ELBOW], lm[LM.LEFT_SHOULDER]);
    const wristY    = lm[LM.LEFT_WRIST].y;
    const shoulderY = lm[LM.LEFT_SHOULDER].y;
    const noseY     = lm[LM.NOSE].y;
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "bottom" && wristY > shoulderY) newPhase = "top";
    else if (phase === "top" && elbowAngle > 160) {
      newPhase = "bottom"; repCounted = true; repQuality = "complete";
    }

    const rightElbow    = calcAngle(lm[LM.RIGHT_WRIST], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_SHOULDER]);
    const symmetryPenalty = clamp(Math.abs(rightElbow - elbowAngle) * 0.5, 0, 20);
    const hipMidX       = midpoint(lm[LM.LEFT_HIP],      lm[LM.RIGHT_HIP]).x;
    const shMidX        = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]).x;
    const swingPenalty  = clamp(Math.abs(hipMidX - shMidX) * 100, 0, 20);
    const extensionBonus = clamp((elbowAngle / 180) * 40, 0, 40);
    const formScore = clamp(60 + extensionBonus - symmetryPenalty - swingPenalty, 0, 100);

    let audioCue: string | null = null;
    if (formScore < 65) {
      // Chin-over-bar check: at "top" phase, nose should be clearly above wrist level
      const chinOverBar = noseY < wristY - 0.04;
      if (phase === "top" && !chinOverBar) {
        audioCue = pickFormCue("Pull-Up", "chin_not_over_bar");
      } else if (swingPenalty > symmetryPenalty) {
        audioCue = pickFormCue("Pull-Up", "swinging");
      } else {
        audioCue = pickFormCue("Pull-Up", "pull_evenly");
      }
    }
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── Explosive Pull-Up (Muscle-Up Path L3) ────────────────────────────────────

const EXPLOSIVE_PULL_UP: ExerciseConfig = {
  displayName: "Explosive Pull-Up",
  isStatic: false,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Wrist–Elbow–Shoulder", description: "Pull explosively until chest clears bar level. Full extension at bottom." },
    { label: "Hip swing control", description: "Minimal kip — explosive pull should do the work, not body swing." },
  ],
  initialPhase: "bottom",
  processFrame(lm, phase) {
    const elbowAngle = calcAngle(lm[LM.LEFT_WRIST], lm[LM.LEFT_ELBOW], lm[LM.LEFT_SHOULDER]);
    const wristY = lm[LM.LEFT_WRIST].y;
    const shoulderY = lm[LM.LEFT_SHOULDER].y;
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    // Rep top = wrist significantly above shoulder (chest near bar, not just chin)
    if (phase === "bottom" && wristY > shoulderY + 0.05) newPhase = "top";
    else if (phase === "top" && elbowAngle > 155) {
      newPhase = "bottom"; repCounted = true; repQuality = "complete";
    }

    const hipMidX = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]).x;
    const shMidX = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]).x;
    const swingPenalty = clamp(Math.abs(hipMidX - shMidX) * 80, 0, 25);
    const formScore = clamp(100 - swingPenalty, 0, 100);

    const audioCue = formScore < 65 ? pickFormCue("Explosive Pull-Up", "swinging") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── Muscle-Up ────────────────────────────────────────────────────────────────
// Multi-phase: pull → bar transition → push above bar.
// Simplified: rep counted when wrists rise above shoulder level AND
// then the body presses upward (shoulder rises above wrist level briefly).

const MUSCLE_UP: ExerciseConfig = {
  displayName: "Muscle-Up",
  isStatic: false,
  difficultyWeight: 10.0,
  criticalJoints: [
    { label: "Wrist y vs Hip y", description: "Full muscle-up: wrists must clear shoulder level on the pull, then press above." },
    { label: "Shoulder–Elbow–Wrist", description: "Elbow extension at the top of the press-out confirms a complete rep." },
  ],
  initialPhase: "bottom",
  processFrame(lm, phase) {
    const elbowAngle = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    const wristY = (lm[LM.LEFT_WRIST].y + lm[LM.RIGHT_WRIST].y) / 2;
    const shoulderY = (lm[LM.LEFT_SHOULDER].y + lm[LM.RIGHT_SHOULDER].y) / 2;

    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    // Transition: bar passes from below (wrist above shoulder) → pressing out above
    if (phase === "bottom" && wristY > shoulderY) newPhase = "top";
    // Press-out complete: elbow locks out and shoulders now below wrists
    else if (phase === "top" && elbowAngle > 155 && shoulderY > wristY + 0.05) {
      newPhase = "bottom"; repCounted = true; repQuality = "complete";
    }

    // Form: check elbow lock-out at top
    const lockScore = clamp((elbowAngle / 160) * 70, 0, 70);
    const swingPenalty = clamp(
      Math.abs(midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]).x - midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]).x) * 80,
      0, 30,
    );
    const formScore = clamp(lockScore + 30 - swingPenalty, 0, 100);

    let audioCue: string | null = null;
    if (formScore < 65) {
      audioCue = elbowAngle < 120
        ? pickFormCue("Muscle-Up", "no_full_extension")
        : pickFormCue("Muscle-Up", "swinging");
    }
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── Static Pull: Front Lever Progressions ────────────────────────────────────
//
// Active Zone definition for ALL front lever variants:
//   - Body horizontal: |shoulder.y - hip.y| within threshold
//   - Elbows extended: shoulder-elbow-wrist angle > 150°
//   - Tolerance: ±10° on "body tilt from horizontal" (approximated via y-diff)
//
// The formScore reflects how close to perfectly horizontal the body is.

const TUCK_FRONT_LEVER: ExerciseConfig = {
  displayName: "Tuck Front Lever",
  isStatic: true,
  difficultyWeight: 3.0,
  criticalJoints: [
    { label: "Body horizontality", description: "Shoulder and hip should be at the same height — body perfectly horizontal." },
    { label: "Elbow lock-out", description: "Arms stay fully extended throughout the hold." },
  ],
  initialPhase: "hold",
  processFrame(lm, _phase) {
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const leftElbowAngle = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    const rightElbowAngle = calcAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]);
    const avgElbowAngle = (leftElbowAngle + rightElbowAngle) / 2;

    // Body tilt: |shoulder.y - hip.y| in normalised units; 0 = perfect horizontal
    // Approximate target angle: 0°, tolerance: ±10° ≈ ±0.18 normalised units at typical camera distance
    const bodyTiltDiff = Math.abs(shoulderMid.y - hipMid.y);
    const bodyTiltAngle = Math.atan(bodyTiltDiff) * (180 / Math.PI); // ~0–15° typical

    const isBodyHorizontal = inZone(bodyTiltAngle, 0, 12);
    const isElbowsExtended = avgElbowAngle > 145;
    const isHoldActive = isBodyHorizontal && isElbowsExtended;

    // Form score: penalise body tilt and elbow bend
    const tiltPenalty = clamp(bodyTiltAngle * 4, 0, 50);
    const elbowPenalty = clamp((160 - avgElbowAngle) * 1.2, 0, 40);
    const formScore = clamp(100 - tiltPenalty - elbowPenalty, 0, 100);

    let audioCue: string | null = null;
    if (!isElbowsExtended) audioCue = pickFormCue("Tuck Front Lever", "arms_bent");
    else if (!isBodyHorizontal) {
      audioCue = pickFormCue("Tuck Front Lever", "body_not_horizontal");
    }

    return { newPhase: "hold", repCounted: false, repQuality: null, formScore, audioCue, isHoldActive };
  },
};

const STRADDLE_FRONT_LEVER: ExerciseConfig = {
  displayName: "Straddle Front Lever",
  isStatic: true,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Body horizontality", description: "Hips must be level with shoulders — body horizontal." },
    { label: "Elbow lock-out", description: "Arms stay fully extended throughout." },
  ],
  initialPhase: "hold",
  processFrame(lm, _phase) {
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const leftElbowAngle = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    const rightElbowAngle = calcAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]);
    const avgElbowAngle = (leftElbowAngle + rightElbowAngle) / 2;

    const bodyTiltDiff = Math.abs(shoulderMid.y - hipMid.y);
    const bodyTiltAngle = Math.atan(bodyTiltDiff) * (180 / Math.PI);

    // Stricter horizontal requirement than tuck lever
    const isBodyHorizontal = inZone(bodyTiltAngle, 0, 10);
    const isElbowsExtended = avgElbowAngle > 148;
    const isHoldActive = isBodyHorizontal && isElbowsExtended;

    const tiltPenalty = clamp(bodyTiltAngle * 5, 0, 55);
    const elbowPenalty = clamp((160 - avgElbowAngle) * 1.3, 0, 40);
    const formScore = clamp(100 - tiltPenalty - elbowPenalty, 0, 100);

    let audioCue: string | null = null;
    if (!isElbowsExtended) audioCue = pickFormCue("Straddle Front Lever", "arms_bent");
    else if (!isBodyHorizontal) {
      audioCue = pickFormCue("Straddle Front Lever", "body_not_horizontal");
    }

    return { newPhase: "hold", repCounted: false, repQuality: null, formScore, audioCue, isHoldActive };
  },
};

const FULL_FRONT_LEVER: ExerciseConfig = {
  displayName: "Full Front Lever",
  isStatic: true,
  difficultyWeight: 10.0,
  criticalJoints: [
    { label: "Shoulder–Ankle horizontality", description: "Entire body must be horizontal from shoulder to ankle." },
    { label: "Elbow lock-out", description: "Arms fully extended, zero bend allowed." },
  ],
  initialPhase: "hold",
  processFrame(lm, _phase) {
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const ankleMid = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);
    const leftElbowAngle = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    const rightElbowAngle = calcAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]);
    const avgElbowAngle = (leftElbowAngle + rightElbowAngle) / 2;

    // Full body must be horizontal — check shoulder-to-ankle tilt
    const bodyTiltDiff = Math.abs(shoulderMid.y - ankleMid.y);
    const bodyTiltAngle = Math.atan(bodyTiltDiff) * (180 / Math.PI);

    // Strictest check — only ±8° tolerance
    const isBodyHorizontal = inZone(bodyTiltAngle, 0, 8);
    const isElbowsExtended = avgElbowAngle > 150;
    const isHoldActive = isBodyHorizontal && isElbowsExtended;

    const tiltPenalty = clamp(bodyTiltAngle * 6, 0, 60);
    const elbowPenalty = clamp((165 - avgElbowAngle) * 1.5, 0, 40);
    const formScore = clamp(100 - tiltPenalty - elbowPenalty, 0, 100);

    let audioCue: string | null = null;
    if (!isElbowsExtended) audioCue = pickFormCue("Full Front Lever", "arms_bent");
    else if (!isBodyHorizontal) audioCue = pickFormCue("Full Front Lever", "body_not_horizontal");

    return { newPhase: "hold", repCounted: false, repQuality: null, formScore, audioCue, isHoldActive };
  },
};

// ─── Dragon Flag (Core L4, static) ───────────────────────────────────────────
// Person lies on a bench, grips behind the head, and holds body horizontal —
// only upper back and shoulders contact the surface.
// Tracked as: body line (shoulder-hip-ankle) should be ~180° (straight)
// AND the body should be elevated (hips above shoulder level in normalised y).

const DRAGON_FLAG: ExerciseConfig = {
  displayName: "Dragon Flag",
  isStatic: true,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Shoulder–Hip–Ankle line", description: "Body must stay perfectly straight — no pike or sag." },
    { label: "Hip elevation", description: "Only your upper back touches the bench — hold the body horizontal above it." },
  ],
  initialPhase: "hold",
  processFrame(lm, _phase) {
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const ankleMid = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);

    // Body straightness: shoulder-hip-ankle angle should be ~180°
    const bodyAngle = calcAngle(shoulderMid, hipMid, ankleMid);
    // Body tilt from horizontal (shoulder-ankle level difference)
    const bodyTiltDiff = Math.abs(shoulderMid.y - ankleMid.y);
    const bodyTiltAngle = Math.atan(bodyTiltDiff) * (180 / Math.PI);

    // Active zone: body angle within 180±10° AND roughly horizontal
    const isBodyStraight = inZone(bodyAngle, 180, 10);
    const isBodyHorizontal = inZone(bodyTiltAngle, 0, 12);
    const isHoldActive = isBodyStraight && isBodyHorizontal;

    const straightnessPenalty = clamp(Math.abs(180 - bodyAngle) * 3, 0, 50);
    const tiltPenalty = clamp(bodyTiltAngle * 4, 0, 40);
    const formScore = clamp(100 - straightnessPenalty - tiltPenalty, 0, 100);

    let audioCue: string | null = null;
    if (!isBodyStraight) {
      audioCue = bodyAngle < 170
        ? pickFormCue("Dragon Flag", "dont_pike")
        : pickFormCue("Dragon Flag", "squeeze_abs");
    } else if (!isBodyHorizontal) {
      audioCue = pickFormCue("Dragon Flag", "body_not_horizontal");
    }

    return { newPhase: "hold", repCounted: false, repQuality: null, formScore, audioCue, isHoldActive };
  },
};

// ─── Human Flag (Core L5, static) ────────────────────────────────────────────
// Person grips a vertical pole and holds the entire body horizontal to one side.
// Requires a side-on camera view. Tracked as: body line (shoulder-hip-ankle)
// straight AND body horizontal (shoulder.y ≈ hip.y ≈ ankle.y).

const HUMAN_FLAG: ExerciseConfig = {
  displayName: "Human Flag",
  isStatic: true,
  difficultyWeight: 10.0,
  criticalJoints: [
    { label: "Shoulder–Hip–Ankle horizontality", description: "Body must be perfectly horizontal from top arm to feet." },
    { label: "Arm structure", description: "Top arm pushes; bottom arm pulls. Both arms straight." },
  ],
  initialPhase: "hold",
  processFrame(lm, _phase) {
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const ankleMid = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);
    const leftElbow = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    const rightElbow = calcAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]);

    // Shoulder–ankle tilt from horizontal
    const bodyTiltDiff = Math.abs(shoulderMid.y - ankleMid.y);
    const bodyTiltAngle = Math.atan(bodyTiltDiff) * (180 / Math.PI);
    // Body straightness
    const bodyAngle = calcAngle(shoulderMid, hipMid, ankleMid);

    const isBodyHorizontal = inZone(bodyTiltAngle, 0, 10);
    const isBodyStraight = inZone(bodyAngle, 180, 12);
    const isArmsExtended = leftElbow > 140 && rightElbow > 140;
    const isHoldActive = isBodyHorizontal && isBodyStraight && isArmsExtended;

    const tiltPenalty = clamp(bodyTiltAngle * 5, 0, 50);
    const straightPenalty = clamp(Math.abs(180 - bodyAngle) * 2.5, 0, 35);
    const armPenalty = clamp((150 - Math.min(leftElbow, rightElbow)) * 0.8, 0, 20);
    const formScore = clamp(100 - tiltPenalty - straightPenalty - armPenalty, 0, 100);

    let audioCue: string | null = null;
    if (!isArmsExtended) audioCue = pickFormCue("Human Flag", "arms_bent");
    else if (!isBodyHorizontal) audioCue = pickFormCue("Human Flag", "body_not_horizontal");
    else if (!isBodyStraight) audioCue = pickFormCue("Human Flag", "no_rigid_body");

    return { newPhase: "hold", repCounted: false, repQuality: null, formScore, audioCue, isHoldActive };
  },
};

// ─── Leg Regressions ─────────────────────────────────────────────────────────

const ASSISTED_SQUAT: ExerciseConfig = {
  displayName: "Assisted Squat",
  isStatic: false,
  difficultyWeight: 1.0,
  criticalJoints: [
    { label: "Hip–Knee–Ankle (primary)", description: "Knee angle drives rep counting. A shallower depth (120°) is acceptable." },
    { label: "Torso position", description: "Keep your chest tall." },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const kneeAngle = calcAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "up" && kneeAngle < 120) newPhase = "down";
    else if (phase === "down" && kneeAngle > 160) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }

    const torsoAngle = calcAngle(
      midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]),
      midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]),
      midpoint(lm[LM.LEFT_KNEE], lm[LM.RIGHT_KNEE]),
    );
    const torsoPenalty = clamp((90 - torsoAngle) * 1.5, 0, 40);
    const formScore = clamp(100 - torsoPenalty, 0, 100);
    const audioCue = formScore < 60 ? pickFormCue("Assisted Squat", "chest_dropping") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const SQUAT: ExerciseConfig = {
  displayName: "Squat",
  isStatic: false,
  difficultyWeight: 3.0,
  criticalJoints: [
    { label: "Hip–Knee–Ankle (primary)", description: "Knee angle drives rep counting. Must break 100° at the bottom." },
    { label: "Hip depth vs Knee height", description: "Rep is incomplete if hip doesn't reach knee depth." },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const kneeAngle = calcAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "up" && kneeAngle < 100) newPhase = "down";
    else if (phase === "down" && kneeAngle > 160) {
      newPhase = "up"; repCounted = true;
      const hipY = lm[LM.LEFT_HIP].y;
      const kneeY = lm[LM.LEFT_KNEE].y;
      repQuality = hipY < kneeY ? "incomplete" : "complete";
    }

    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid      = midpoint(lm[LM.LEFT_HIP],      lm[LM.RIGHT_HIP]);
    const kneeMid     = midpoint(lm[LM.LEFT_KNEE],     lm[LM.RIGHT_KNEE]);
    const ankleMid    = midpoint(lm[LM.LEFT_ANKLE],    lm[LM.RIGHT_ANKLE]);

    const torsoAngle = calcAngle(shoulderMid, hipMid, kneeMid);
    const torsoPenalty = clamp((90 - torsoAngle) * 1.5, 0, 40);

    // Forward lean: shoulders significantly ahead of hips (x-axis)
    const forwardLean = Math.abs(shoulderMid.x - hipMid.x) > 0.09;

    // Heel rise: ankle y drifts significantly relative to knee (heels lifting)
    const heelRise = (ankleMid.y - kneeMid.y) > 0.38;

    const kneeDrift   = Math.abs(lm[LM.LEFT_KNEE].x - lm[LM.LEFT_ANKLE].x) * 100;
    const kneePenalty = clamp(kneeDrift, 0, 30);
    const formScore   = clamp(100 - torsoPenalty - kneePenalty, 0, 100);

    let audioCue: string | null = null;
    if (repQuality === "incomplete") {
      audioCue = pickFormCue("Squat", "not_deep_enough");
    } else if (formScore < 60) {
      if (heelRise) {
        audioCue = pickFormCue("Squat", "heels_rising");
      } else if (forwardLean) {
        audioCue = pickFormCue("Squat", "chest_dropping");
      } else if (kneePenalty > torsoPenalty) {
        audioCue = pickFormCue("Squat", "knees_caving");
      } else {
        audioCue = pickFormCue("Squat", "core_loose");
      }
    }
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const ARCHER_SQUAT: ExerciseConfig = {
  displayName: "Archer Squat",
  isStatic: false,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Hip–Knee–Ankle (working leg)", description: "Track the bending leg — deep knee flexion required." },
    { label: "Extended leg straightness", description: "Keep the extended leg locked out to the side throughout." },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const kneeAngle = calcAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "up" && kneeAngle < 100) newPhase = "down";
    else if (phase === "down" && kneeAngle > 155) {
      newPhase = "up"; repCounted = true;
      const hipY = lm[LM.LEFT_HIP].y;
      const kneeY = lm[LM.LEFT_KNEE].y;
      repQuality = hipY < kneeY ? "incomplete" : "complete";
    }

    const extLegAngle = calcAngle(lm[LM.RIGHT_HIP], lm[LM.RIGHT_KNEE], lm[LM.RIGHT_ANKLE]);
    const extPenalty = clamp((150 - extLegAngle) * 1.2, 0, 40);
    const torsoPenalty = clamp(
      (90 - calcAngle(
        midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]),
        midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]),
        midpoint(lm[LM.LEFT_KNEE], lm[LM.RIGHT_KNEE]),
      )) * 1.0, 0, 30,
    );
    const formScore = clamp(100 - extPenalty - torsoPenalty, 0, 100);
    let audioCue: string | null = null;
    if (extPenalty > torsoPenalty && formScore < 65) audioCue = pickFormCue("Archer Squat", "one_arm_bent");
    else if (formScore < 60) audioCue = pickFormCue("Archer Squat", "not_deep_enough");
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const PISTOL_SQUAT: ExerciseConfig = {
  displayName: "Pistol Squat",
  isStatic: false,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Hip–Knee–Ankle (single leg)", description: "Track the working leg. Deep flexion required — break 85° at the bottom." },
    { label: "Free leg extension", description: "Keep the non-working leg extended forward, parallel to ground." },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const kneeAngle = calcAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "up" && kneeAngle < 85) newPhase = "down";
    else if (phase === "down" && kneeAngle > 155) {
      newPhase = "up"; repCounted = true;
      const hipY = lm[LM.LEFT_HIP].y;
      const kneeY = lm[LM.LEFT_KNEE].y;
      repQuality = hipY < kneeY ? "incomplete" : "complete";
    }

    const freeAnkleElevated = lm[LM.RIGHT_ANKLE].y < lm[LM.RIGHT_HIP].y + 0.1;
    const freeLegPenalty = freeAnkleElevated ? 0 : 25;
    const torsoPenalty = clamp(
      (90 - calcAngle(
        midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]),
        midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]),
        midpoint(lm[LM.LEFT_KNEE], lm[LM.RIGHT_KNEE]),
      )) * 1.0, 0, 35,
    );
    const formScore = clamp(100 - freeLegPenalty - torsoPenalty, 0, 100);
    let audioCue: string | null = null;
    if (freeLegPenalty > 0 && formScore < 70) audioCue = pickFormCue("Pistol Squat", "free_leg_down");
    else if (formScore < 60) audioCue = pickFormCue("Pistol Squat", "not_deep_enough");
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── Nordic Curls (Legs L4) ───────────────────────────────────────────────────
// Kneeling: ankles anchored. Lower body forward slowly under control.
// Phase: "up" = upright kneeling, "down" = lowered forward.
// Rep counted when returning to upright position.
// Track: shoulder Y relative to knee Y (when lowered, shoulder rises above/below).

const NORDIC_CURLS: ExerciseConfig = {
  displayName: "Nordic Curls",
  isStatic: false,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Shoulder relative to Knee", description: "Controls the lowering arc. Lower slowly until you can no longer resist." },
    { label: "Hip–Knee–Ankle line", description: "Keep hips neutral — don't break at the hips. Lower as a rigid unit." },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const kneeMid = midpoint(lm[LM.LEFT_KNEE], lm[LM.RIGHT_KNEE]);
    const hipMid = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);

    // In upright kneeling: shoulder is well above knee (shoulder.y < knee.y)
    // As they lower: shoulder approaches knee level and eventually goes below
    const shoulderAboveKnee = shoulderMid.y < kneeMid.y;

    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    // Lowering: shoulder drops toward or below knee
    if (phase === "up" && !shoulderAboveKnee) newPhase = "down";
    // Returning: shoulder rises back above knee
    else if (phase === "down" && shoulderAboveKnee) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }

    // Form: check for hip break — should maintain straight hip-knee-ankle
    const hipAngle = calcAngle(shoulderMid, hipMid, kneeMid);
    // Ideal: ~180° (rigid body), penalise if they break at the hips
    const hipBreakPenalty = clamp(Math.abs(180 - hipAngle) * 2, 0, 50);
    const formScore = clamp(100 - hipBreakPenalty, 0, 100);

    let audioCue: string | null = null;
    if (formScore < 60) audioCue = pickFormCue("Nordic Curls", "no_rigid_body");

    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── Other exercises ─────────────────────────────────────────────────────────

const PLANK: ExerciseConfig = {
  displayName: "Plank",
  isStatic: true,
  difficultyWeight: 1.0,
  criticalJoints: [
    { label: "Shoulder–Hip–Ankle line (primary)", description: "Body must form a straight line from shoulder to ankle." },
    { label: "Hip y vs Shoulder–Ankle midpoint", description: "Triggers cue when hips pike up or sag down." },
  ],
  initialPhase: "hold",
  processFrame(lm, _phase) {
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const ankleMid = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);

    const saMiddleY = (shoulderMid.y + ankleMid.y) / 2;
    const hipAbove = saMiddleY - hipMid.y > 0.10;
    const hipBelow = hipMid.y - saMiddleY > 0.10;

    const bodyAngle = calcAngle(shoulderMid, hipMid, ankleMid);
    const formScore = clamp(100 - Math.abs(180 - bodyAngle) * 3, 0, 100);

    // Active zone: body angle within 180±10° (hips not piked or sagging)
    const isHoldActive = inZone(bodyAngle, 180, 10);

    let audioCue: string | null = null;
    if (hipAbove) audioCue = pickFormCue("Plank", "hips_too_high");
    else if (hipBelow) audioCue = pickFormCue("Plank", "hips_sagging");
    else if (formScore < 70) audioCue = pickFormCue("Plank", "core_loose");

    return { newPhase: "hold", repCounted: false, repQuality: null, formScore, audioCue, isHoldActive };
  },
};

const DIP: ExerciseConfig = {
  displayName: "Dip",
  isStatic: false,
  difficultyWeight: 3.0,
  criticalJoints: [
    { label: "Shoulder–Elbow–Wrist", description: "Elbow angle drives rep counting. Elbows stay tucked, not flared." },
    { label: "Torso lean", description: "Slight forward lean shifts emphasis to the chest." },
  ],
  initialPhase: "up",
  processFrame(lm, phase, equipment) {
    const elbowAngle = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "up" && elbowAngle < 90) newPhase = "down";
    else if (phase === "down" && elbowAngle > (equipment?.pushDepthThreshold ?? 150)) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }

    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const bodyLean = Math.abs(shoulderMid.x - hipMid.x) * 100;
    const formScore = clamp(100 - Math.max(0, bodyLean - 5) * 2, 0, 100);
    const audioCue = formScore < 60 ? pickFormCue("Dip", "elbows_flaring") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const LUNGE: ExerciseConfig = {
  displayName: "Lunge",
  isStatic: false,
  difficultyWeight: 3.0,
  criticalJoints: [
    { label: "Hip–Knee–Ankle (front leg)", description: "Front-leg knee angle drives rep counting." },
    { label: "Knee alignment", description: "Front knee must track directly over the foot." },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const kneeAngle = calcAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "up" && kneeAngle < 110) newPhase = "down";
    else if (phase === "down" && kneeAngle > 155) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }

    const torsoAngle = calcAngle(
      midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]),
      midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]),
      midpoint(lm[LM.LEFT_KNEE], lm[LM.RIGHT_KNEE]),
    );
    const formScore = clamp(torsoAngle - 20, 0, 100);
    const audioCue = formScore < 60 ? pickFormCue("Lunge", "chest_dropping") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const BURPEE: ExerciseConfig = {
  displayName: "Burpee",
  isStatic: false,
  difficultyWeight: 3.0,
  criticalJoints: [
    { label: "Shoulder–Hip–Knee", description: "Hip angle cycles from deep crouch to full overhead extension." },
    { label: "Body alignment (plank phase)", description: "Full plank position must be achieved mid-rep." },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const hipAngle = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "up" && hipAngle < 90) newPhase = "down";
    else if (phase === "down" && hipAngle > 160) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }

    const formScore = clamp(hipAngle > 140 ? 90 : hipAngle, 0, 100);
    const audioCue = formScore < 60 ? pickFormCue("Burpee", "no_full_extension") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── Explosive Pull: Chest-to-Bar Pull-Up ─────────────────────────────────────
// Like a pull-up but the chest must clear bar level — wrists rise well above shoulders.

const CHEST_TO_BAR_PULL_UP: ExerciseConfig = {
  displayName: "Chest-to-Bar Pull-Up",
  isStatic: false,
  difficultyWeight: 3.0,
  criticalJoints: [
    { label: "Wrist–Elbow–Shoulder", description: "Full dead-hang extension at the bottom — elbows locked out." },
    { label: "Wrist Y vs Chest level", description: "Rep only counts when wrists clear well above shoulder height — chest must touch bar." },
  ],
  initialPhase: "bottom",
  processFrame(lm, phase) {
    const elbowAngle = calcAngle(lm[LM.LEFT_WRIST], lm[LM.LEFT_ELBOW], lm[LM.LEFT_SHOULDER]);
    const wristY    = (lm[LM.LEFT_WRIST].y  + lm[LM.RIGHT_WRIST].y)  / 2;
    const shoulderY = (lm[LM.LEFT_SHOULDER].y + lm[LM.RIGHT_SHOULDER].y) / 2;
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    // Chest-to-bar: wrists must be significantly above shoulder level
    const chestClear = wristY > shoulderY + 0.10;
    if (phase === "bottom" && chestClear) newPhase = "top";
    else if (phase === "top" && elbowAngle > 160) {
      newPhase = "bottom"; repCounted = true; repQuality = "complete";
    }

    const hipMidX = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]).x;
    const shMidX  = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]).x;
    const swingPenalty = clamp(Math.abs(hipMidX - shMidX) * 80, 0, 25);
    const depthBonus   = chestClear ? 20 : 0;
    const formScore    = clamp(80 + depthBonus - swingPenalty, 0, 100);

    let audioCue: string | null = null;
    if (phase === "top" && !chestClear) audioCue = pickFormCue("Chest-to-Bar Pull-Up", "chest_to_bar_cue");
    else if (swingPenalty > 15) audioCue = pickFormCue("Chest-to-Bar Pull-Up", "swinging");
    else if (phase === "bottom" && elbowAngle < 150) audioCue = pickFormCue("Chest-to-Bar Pull-Up", "dead_hang_required");
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── Explosive Pull: Archer Pull-Up ───────────────────────────────────────────
// One arm performs the pull while the other extends straight to the side — tracking
// the working (left) arm elbow and ensuring the extended (right) arm stays locked.

const ARCHER_PULL_UP: ExerciseConfig = {
  displayName: "Archer Pull-Up",
  isStatic: false,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Working arm Elbow (Wrist–Elbow–Shoulder)", description: "Track the bending arm — drives the rep count." },
    { label: "Extended arm straightness", description: "The straight arm must stay locked out throughout the movement." },
  ],
  initialPhase: "bottom",
  processFrame(lm, phase) {
    const workElbow = calcAngle(lm[LM.LEFT_WRIST], lm[LM.LEFT_ELBOW], lm[LM.LEFT_SHOULDER]);
    const extElbow  = calcAngle(lm[LM.RIGHT_WRIST], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_SHOULDER]);
    const wristY    = lm[LM.LEFT_WRIST].y;
    const shoulderY = lm[LM.LEFT_SHOULDER].y;
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "bottom" && wristY > shoulderY) newPhase = "top";
    else if (phase === "top" && workElbow > 155) {
      newPhase = "bottom"; repCounted = true; repQuality = "complete";
    }

    // Penalise extended arm bending
    const extPenalty = clamp((145 - extElbow) * 1.2, 0, 40);
    const swingPenalty = clamp(
      Math.abs(midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]).x - midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]).x) * 80,
      0, 25,
    );
    const formScore = clamp(100 - extPenalty - swingPenalty, 0, 100);

    let audioCue: string | null = null;
    if (extPenalty > 20) audioCue = pickFormCue("Archer Pull-Up", "one_arm_bent");
    else if (swingPenalty > 15) audioCue = pickFormCue("Archer Pull-Up", "swinging");
    else if (formScore < 65) audioCue = pickFormCue("Archer Pull-Up", "no_full_extension");
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── Overhead Pressing: Pike Push-Up ──────────────────────────────────────────
// Inverted-V / downward-dog position. Elbows bend to lower head toward floor.

const PIKE_PUSH_UP: ExerciseConfig = {
  displayName: "Pike Push-Up",
  isStatic: false,
  difficultyWeight: 3.0,
  criticalJoints: [
    { label: "Shoulder–Elbow–Wrist", description: "Elbow angle drives rep counting. Lower your head between your hands to full depth." },
    { label: "Hip elevation", description: "Hips must stay high throughout — maintain the inverted V throughout the set." },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const elbowAngle = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "up" && elbowAngle < 90) newPhase = "down";
    else if (phase === "down" && elbowAngle > 150) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }

    // Hip elevation: in normalised coords, lower y = higher in space.
    // Hips above shoulders → hipMid.y < shoulderMid.y
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid      = midpoint(lm[LM.LEFT_HIP],      lm[LM.RIGHT_HIP]);
    const hipElevation = shoulderMid.y - hipMid.y; // positive = hips higher
    const hipPenalty   = clamp((0.10 - hipElevation) * 200, 0, 40);
    const formScore    = clamp(100 - hipPenalty, 0, 100);

    let audioCue: string | null = null;
    if (hipPenalty > 20) audioCue = pickFormCue("Pike Push-Up", "hips_too_high");
    else if (formScore < 65) audioCue = pickFormCue("Pike Push-Up", "not_deep_enough");
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── Overhead Pressing: Elevated Pike Push-Up ─────────────────────────────────
// Feet on an elevated surface — same mechanics as pike push-up but greater shoulder
// range of motion and load. Stricter hip elevation required.

const ELEVATED_PIKE_PUSH_UP: ExerciseConfig = {
  displayName: "Elevated Pike Push-Up",
  isStatic: false,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Shoulder–Elbow–Wrist", description: "Elbow angle drives rep counting. Full lock-out at the top." },
    { label: "Hip elevation (elevated feet)", description: "With feet elevated the hips must be even higher than a standard pike — don't let them drop." },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const elbowAngle = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "up" && elbowAngle < 85) newPhase = "down";
    else if (phase === "down" && elbowAngle > 150) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }

    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid      = midpoint(lm[LM.LEFT_HIP],      lm[LM.RIGHT_HIP]);
    // Elevated pike requires a steeper angle — hips must be noticeably higher
    const hipElevation = shoulderMid.y - hipMid.y;
    const hipPenalty   = clamp((0.15 - hipElevation) * 200, 0, 45);
    const formScore    = clamp(100 - hipPenalty, 0, 100);

    let audioCue: string | null = null;
    if (hipPenalty > 25) audioCue = pickFormCue("Elevated Pike Push-Up", "hips_too_high");
    else if (formScore < 65) audioCue = pickFormCue("Elevated Pike Push-Up", "not_deep_enough");
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── Static Holds: Hollow Body Hold ───────────────────────────────────────────
// Lying supine: shoulders and straight legs raised, lower back pressed to floor.
// Tracked from a side-camera view: both shoulders and ankles elevated above hip level.

const HOLLOW_BODY_HOLD: ExerciseConfig = {
  displayName: "Hollow Body Hold",
  isStatic: true,
  difficultyWeight: 3.0,
  criticalJoints: [
    { label: "Ankle elevation (above hips)", description: "Legs must be raised and held straight — the lower the legs, the harder the hold." },
    { label: "Shoulder elevation", description: "Shoulders must curl off the floor — arms reach forward alongside the ears." },
  ],
  initialPhase: "hold",
  processFrame(lm, _phase) {
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid      = midpoint(lm[LM.LEFT_HIP],      lm[LM.RIGHT_HIP]);
    const ankleMid    = midpoint(lm[LM.LEFT_ANKLE],    lm[LM.RIGHT_ANKLE]);

    // In normalised coords (y = 0 at top): lower y = higher in frame.
    // When lying on back (camera from side): hips on floor (highest y),
    // both shoulders and ankles elevated above hips (lower y than hips).
    const anklesElevated   = ankleMid.y   < hipMid.y - 0.05;
    const shouldersElevated = shoulderMid.y < hipMid.y - 0.02;

    // Body should be roughly horizontal — shoulder-to-ankle tilt
    const bodyTiltDiff  = Math.abs(shoulderMid.y - ankleMid.y);
    const bodyTiltAngle = Math.atan(bodyTiltDiff) * (180 / Math.PI);
    const isHorizontal  = bodyTiltAngle < 20;

    const isHoldActive = anklesElevated && shouldersElevated && isHorizontal;

    const elevationScore = Math.min(
      clamp((hipMid.y - ankleMid.y) * 200, 0, 50),
      clamp((hipMid.y - shoulderMid.y) * 200, 0, 50),
    );
    const tiltPenalty = clamp(bodyTiltAngle * 2, 0, 40);
    const formScore   = clamp(50 + elevationScore - tiltPenalty, 0, 100);

    let audioCue: string | null = null;
    if (!anklesElevated)    audioCue = pickFormCue("Hollow Body Hold", "free_leg_down");
    else if (!shouldersElevated) audioCue = pickFormCue("Hollow Body Hold", "no_rigid_body");
    else if (!isHorizontal) audioCue = pickFormCue("Hollow Body Hold", "core_loose");
    return { newPhase: "hold", repCounted: false, repQuality: null, formScore, audioCue, isHoldActive };
  },
};

// ─── Static Holds: Tuck L-Sit ─────────────────────────────────────────────────
// On parallel bars or floor: arms locked out, hips raised above wrists, knees tucked.

const TUCK_L_SIT: ExerciseConfig = {
  displayName: "Tuck L-Sit",
  isStatic: true,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Hip elevation (above Wrists)", description: "Hips must be raised above wrist level — press the floor/bars away." },
    { label: "Elbow lock-out", description: "Arms stay fully extended — bent elbows break the position." },
  ],
  initialPhase: "hold",
  processFrame(lm, _phase) {
    const wristMid = midpoint(lm[LM.LEFT_WRIST],    lm[LM.RIGHT_WRIST]);
    const hipMid   = midpoint(lm[LM.LEFT_HIP],      lm[LM.RIGHT_HIP]);
    const kneeMid  = midpoint(lm[LM.LEFT_KNEE],     lm[LM.RIGHT_KNEE]);
    const leftElbow  = calcAngle(lm[LM.LEFT_SHOULDER],  lm[LM.LEFT_ELBOW],  lm[LM.LEFT_WRIST]);
    const rightElbow = calcAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]);
    const avgElbow   = (leftElbow + rightElbow) / 2;

    // Hips above wrists: hipMid.y < wristMid.y (lower y = higher in frame)
    const hipsElevated = hipMid.y < wristMid.y;
    // Knees tucked: knees near or above hip height
    const kneesTucked  = kneeMid.y <= hipMid.y + 0.05;
    const elbowsExtended = avgElbow > 140;

    const isHoldActive = hipsElevated && elbowsExtended;

    const hipLiftPenalty = hipsElevated ? 0 : clamp((wristMid.y - hipMid.y) * 200, 0, 40);
    const elbowPenalty   = clamp((150 - avgElbow) * 1.2, 0, 40);
    const formScore      = clamp(100 - hipLiftPenalty - elbowPenalty, 0, 100);

    let audioCue: string | null = null;
    if (!elbowsExtended)  audioCue = pickFormCue("Tuck L-Sit", "arms_bent");
    else if (!hipsElevated) audioCue = pickFormCue("Tuck L-Sit", "no_shoulder_depression");
    else if (!kneesTucked)  audioCue = pickFormCue("Tuck L-Sit", "tuck_knees");
    return { newPhase: "hold", repCounted: false, repQuality: null, formScore, audioCue, isHoldActive };
  },
};

// ─── Unilateral Legs: Bulgarian Split Squat ───────────────────────────────────
// Rear foot elevated, front foot forward. Deep knee flexion on the front (working) leg.

const BULGARIAN_SPLIT_SQUAT: ExerciseConfig = {
  displayName: "Bulgarian Split Squat",
  isStatic: false,
  difficultyWeight: 3.0,
  criticalJoints: [
    { label: "Hip–Knee–Ankle (front leg)", description: "Front-leg knee angle drives rep counting. Sink until thigh is parallel to floor." },
    { label: "Torso alignment", description: "Keep your torso upright — don't lean excessively forward." },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const kneeAngle = calcAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "up" && kneeAngle < 100) newPhase = "down";
    else if (phase === "down" && kneeAngle > 155) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }

    const torsoAngle = calcAngle(
      midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]),
      midpoint(lm[LM.LEFT_HIP],      lm[LM.RIGHT_HIP]),
      midpoint(lm[LM.LEFT_KNEE],     lm[LM.RIGHT_KNEE]),
    );
    const torsoPenalty = clamp((90 - torsoAngle) * 1.2, 0, 40);
    const kneeDrift    = Math.abs(lm[LM.LEFT_KNEE].x - lm[LM.LEFT_ANKLE].x) * 100;
    const kneePenalty  = clamp(kneeDrift * 0.8, 0, 30);
    const formScore    = clamp(100 - torsoPenalty - kneePenalty, 0, 100);

    let audioCue: string | null = null;
    if (kneePenalty > torsoPenalty && formScore < 65) audioCue = pickFormCue("Bulgarian Split Squat", "knees_caving");
    else if (formScore < 60) audioCue = pickFormCue("Bulgarian Split Squat", "chest_dropping");
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── Unilateral Legs: Shrimp Squat ────────────────────────────────────────────
// Single-leg squat with the rear foot held behind. Very deep working-leg knee flexion.

const SHRIMP_SQUAT: ExerciseConfig = {
  displayName: "Shrimp Squat",
  isStatic: false,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Hip–Knee–Ankle (working leg)", description: "Drive the working knee deep — aim to touch the floor with the rear knee." },
    { label: "Hip balance", description: "Hip must stay aligned over the working ankle — don't let it drift sideways." },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const kneeAngle = calcAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "up" && kneeAngle < 85) newPhase = "down";
    else if (phase === "down" && kneeAngle > 155) {
      newPhase = "up"; repCounted = true;
      const hipY  = lm[LM.LEFT_HIP].y;
      const kneeY = lm[LM.LEFT_KNEE].y;
      repQuality = hipY < kneeY ? "incomplete" : "complete";
    }

    // Balance: hip should stay over working ankle
    const balancePenalty = clamp(Math.abs(lm[LM.LEFT_HIP].x - lm[LM.LEFT_ANKLE].x) * 100 * 0.6, 0, 35);
    const torsoPenalty   = clamp(
      (90 - calcAngle(
        midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]),
        midpoint(lm[LM.LEFT_HIP],      lm[LM.RIGHT_HIP]),
        midpoint(lm[LM.LEFT_KNEE],     lm[LM.RIGHT_KNEE]),
      )) * 1.0, 0, 35,
    );
    const formScore = clamp(100 - balancePenalty - torsoPenalty, 0, 100);

    let audioCue: string | null = null;
    if (repQuality === "incomplete")         audioCue = pickFormCue("Shrimp Squat", "not_deep_enough");
    else if (balancePenalty > 20 && formScore < 65) audioCue = pickFormCue("Shrimp Squat", "balance");
    else if (formScore < 60)                 audioCue = pickFormCue("Shrimp Squat", "control_descent");
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── New Exercise Configs ──────────────────────────────────────────────────────

const ARCHER_PUSH_UP: ExerciseConfig = {
  displayName: "Archer Push-Up",
  isStatic: false,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Working arm elbow (Shoulder–Elbow–Wrist)", description: "The bending arm drives the rep — lower until elbow reaches 90°." },
    { label: "Extended arm straightness", description: "The straight arm stays locked out throughout the movement." },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const workElbow = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    const extElbow  = calcAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;
    if (phase === "up" && workElbow < 90) newPhase = "down";
    else if (phase === "down" && workElbow > 150) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }
    const extPenalty  = clamp((145 - extElbow) * 1.2, 0, 40);
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid      = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const ankleMid    = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);
    const bodyAngle   = calcAngle(shoulderMid, hipMid, ankleMid);
    const bodyPenalty = clamp(Math.abs(180 - bodyAngle) * 2, 0, 30);
    const formScore   = clamp(100 - extPenalty - bodyPenalty, 0, 100);
    let audioCue: string | null = null;
    if (extPenalty > 20) audioCue = pickFormCue("Archer Push-Up", "one_arm_bent");
    else if (formScore < 65) audioCue = pickFormCue("Archer Push-Up", "no_rigid_body");
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const PSEUDO_PLANCHE_PUSH_UP: ExerciseConfig = {
  displayName: "Pseudo Planche Push-Up",
  isStatic: false,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Shoulder–Elbow–Wrist", description: "Elbow angle drives rep counting — same as push-up but with rotated hands and forward lean." },
    { label: "Forward lean (shoulder over wrist)", description: "Shoulders must be ahead of the hands throughout." },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const elbowAngle  = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;
    if (phase === "up" && elbowAngle < 90) newPhase = "down";
    else if (phase === "down" && elbowAngle > 150) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }
    const shoulderMid  = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const wristMid     = midpoint(lm[LM.LEFT_WRIST], lm[LM.RIGHT_WRIST]);
    const hipMid       = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const ankleMid     = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);
    const leanOffset   = Math.abs(shoulderMid.x - wristMid.x);
    const leanPenalty  = leanOffset > 0.04 ? 0 : clamp((0.04 - leanOffset) * 500, 0, 30);
    const bodyAngle    = calcAngle(shoulderMid, hipMid, ankleMid);
    const bodyPenalty  = clamp(Math.abs(180 - bodyAngle) * 2, 0, 40);
    const formScore    = clamp(100 - leanPenalty - bodyPenalty, 0, 100);
    const audioCue = formScore < 65 ? pickFormCue("Pseudo Planche Push-Up", "no_lean_forward") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const HANDSTAND: ExerciseConfig = {
  displayName: "Handstand",
  isStatic: true,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Wrist–Hip–Ankle vertical alignment", description: "Everything stacked — hips directly above wrists." },
    { label: "Shoulder engagement", description: "Push the floor away — active shoulders, not passive." },
  ],
  initialPhase: "hold",
  processFrame(lm) {
    const wristMid    = midpoint(lm[LM.LEFT_WRIST], lm[LM.RIGHT_WRIST]);
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid      = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const ankleMid    = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);
    const hipDrift    = Math.abs(hipMid.x - wristMid.x);
    const ankleDrift  = Math.abs(ankleMid.x - wristMid.x);
    const shoulderPush = shoulderMid.y - wristMid.y;
    const isAligned   = hipDrift < 0.08 && ankleDrift < 0.12;
    const isHoldActive = isAligned && shoulderPush > 0.03;
    const hipPenalty   = clamp(hipDrift * 200, 0, 50);
    const anklePenalty = clamp(ankleDrift * 150, 0, 30);
    const formScore    = clamp(100 - hipPenalty - anklePenalty * 0.5, 0, 100);
    let audioCue: string | null = null;
    if (hipDrift > 0.10) audioCue = pickFormCue("Handstand", "stack_over_wrists");
    else if (!isHoldActive) audioCue = pickFormCue("Handstand", "no_shoulder_depression");
    return { newPhase: "hold", repCounted: false, repQuality: null, formScore, audioCue, isHoldActive };
  },
};

const PLANCHE_LEAN: ExerciseConfig = {
  displayName: "Planche Lean",
  isStatic: true,
  difficultyWeight: 1.0,
  criticalJoints: [
    { label: "Forward lean (shoulder over wrist)", description: "Lean forward over your wrists — shoulders ahead of wrists is the target." },
    { label: "Body straightness (Shoulder–Hip–Ankle)", description: "Maintain a rigid plank while leaning forward." },
  ],
  initialPhase: "hold",
  processFrame(lm) {
    const wristMid    = midpoint(lm[LM.LEFT_WRIST], lm[LM.RIGHT_WRIST]);
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid      = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const ankleMid    = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);
    const leanOffset  = Math.abs(shoulderMid.x - wristMid.x);
    const isLeaning   = leanOffset < 0.08;
    const bodyAngle   = calcAngle(shoulderMid, hipMid, ankleMid);
    const isStraight  = inZone(bodyAngle, 180, 12);
    const isHoldActive = isLeaning && isStraight;
    const bodyPenalty  = clamp(Math.abs(180 - bodyAngle) * 2.5, 0, 50);
    const leanPenalty  = clamp(leanOffset * 200, 0, 40);
    const formScore    = clamp(100 - bodyPenalty - leanPenalty * 0.5, 0, 100);
    let audioCue: string | null = null;
    if (!isStraight) audioCue = pickFormCue("Planche Lean", "no_rigid_body");
    else if (!isLeaning) audioCue = pickFormCue("Planche Lean", "no_lean_forward");
    return { newPhase: "hold", repCounted: false, repQuality: null, formScore, audioCue, isHoldActive };
  },
};

const TUCK_PLANCHE: ExerciseConfig = {
  displayName: "Tuck Planche",
  isStatic: true,
  difficultyWeight: 3.0,
  criticalJoints: [
    { label: "Hip elevation above wrists", description: "Hips must be raised completely off the ground." },
    { label: "Elbow lock-out", description: "Arms fully extended throughout the hold." },
  ],
  initialPhase: "hold",
  processFrame(lm) {
    const wristMid    = midpoint(lm[LM.LEFT_WRIST], lm[LM.RIGHT_WRIST]);
    const hipMid      = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const leftElbow   = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    const rightElbow  = calcAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]);
    const avgElbow    = (leftElbow + rightElbow) / 2;
    const hipsElevated = hipMid.y < wristMid.y;
    const isElbowsExtended = avgElbow > 145;
    const isHoldActive = hipsElevated && isElbowsExtended;
    const hipPenalty   = hipsElevated ? 0 : clamp((wristMid.y - hipMid.y) * 300, 0, 50);
    const elbowPenalty = clamp((155 - avgElbow) * 1.2, 0, 40);
    const formScore    = clamp(100 - hipPenalty - elbowPenalty, 0, 100);
    let audioCue: string | null = null;
    if (!isElbowsExtended) audioCue = pickFormCue("Tuck Planche", "arms_bent");
    else if (!hipsElevated) audioCue = pickFormCue("Tuck Planche", "no_lean_forward");
    return { newPhase: "hold", repCounted: false, repQuality: null, formScore, audioCue, isHoldActive };
  },
};

const STRADDLE_PLANCHE: ExerciseConfig = {
  displayName: "Straddle Planche",
  isStatic: true,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Body horizontality (shoulder–hip)", description: "Body must be horizontal — shoulders and hips at the same height." },
    { label: "Arm lock-out", description: "Elbows fully extended throughout the hold." },
  ],
  initialPhase: "hold",
  processFrame(lm) {
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid      = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const leftElbow   = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    const rightElbow  = calcAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]);
    const avgElbow    = (leftElbow + rightElbow) / 2;
    const bodyTiltDiff  = Math.abs(shoulderMid.y - hipMid.y);
    const bodyTiltAngle = Math.atan(bodyTiltDiff) * (180 / Math.PI);
    const isBodyHorizontal = inZone(bodyTiltAngle, 0, 10);
    const isElbowsExtended = avgElbow > 150;
    const isHoldActive = isBodyHorizontal && isElbowsExtended;
    const tiltPenalty  = clamp(bodyTiltAngle * 5, 0, 55);
    const elbowPenalty = clamp((160 - avgElbow) * 1.3, 0, 40);
    const formScore    = clamp(100 - tiltPenalty - elbowPenalty, 0, 100);
    let audioCue: string | null = null;
    if (!isElbowsExtended) audioCue = pickFormCue("Straddle Planche", "arms_bent");
    else if (!isBodyHorizontal) audioCue = pickFormCue("Straddle Planche", "body_not_horizontal");
    return { newPhase: "hold", repCounted: false, repQuality: null, formScore, audioCue, isHoldActive };
  },
};

const PLANCHE: ExerciseConfig = {
  displayName: "Planche",
  isStatic: true,
  difficultyWeight: 10.0,
  criticalJoints: [
    { label: "Body horizontality (shoulder–ankle)", description: "Entire body horizontal from shoulder to ankle — legs together." },
    { label: "Elbow lock-out", description: "Arms fully extended with maximum depression and forward lean." },
  ],
  initialPhase: "hold",
  processFrame(lm) {
    const shoulderMid  = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const ankleMid     = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);
    const leftElbow    = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    const rightElbow   = calcAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]);
    const avgElbow     = (leftElbow + rightElbow) / 2;
    const bodyTiltDiff  = Math.abs(shoulderMid.y - ankleMid.y);
    const bodyTiltAngle = Math.atan(bodyTiltDiff) * (180 / Math.PI);
    const isBodyHorizontal = inZone(bodyTiltAngle, 0, 8);
    const isElbowsExtended = avgElbow > 152;
    const isHoldActive = isBodyHorizontal && isElbowsExtended;
    const tiltPenalty  = clamp(bodyTiltAngle * 6, 0, 60);
    const elbowPenalty = clamp((160 - avgElbow) * 1.5, 0, 40);
    const formScore    = clamp(100 - tiltPenalty - elbowPenalty, 0, 100);
    let audioCue: string | null = null;
    if (!isElbowsExtended) audioCue = pickFormCue("Planche", "arms_bent");
    else if (!isBodyHorizontal) audioCue = pickFormCue("Planche", "body_not_horizontal");
    return { newPhase: "hold", repCounted: false, repQuality: null, formScore, audioCue, isHoldActive };
  },
};

const SIDE_PLANK: ExerciseConfig = {
  displayName: "Side Plank",
  isStatic: true,
  difficultyWeight: 1.0,
  criticalJoints: [
    { label: "Hip elevation", description: "Hips must stay lifted — no sagging toward the floor." },
    { label: "Shoulder–Hip–Ankle line", description: "Body must form a straight lateral line from head to feet." },
  ],
  initialPhase: "hold",
  processFrame(lm) {
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid      = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const ankleMid    = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);
    const bodyAngle   = calcAngle(shoulderMid, hipMid, ankleMid);
    const sagMid      = (shoulderMid.y + ankleMid.y) / 2;
    const hipSag      = hipMid.y - sagMid;
    const isBodyStraight = inZone(bodyAngle, 180, 15);
    const isHipElevated  = hipSag < 0.08;
    const isHoldActive   = isBodyStraight && isHipElevated;
    const bodyPenalty = clamp(Math.abs(180 - bodyAngle) * 2, 0, 50);
    const sagPenalty  = clamp(Math.max(0, hipSag) * 200, 0, 40);
    const formScore   = clamp(100 - bodyPenalty - sagPenalty, 0, 100);
    let audioCue: string | null = null;
    if (!isHipElevated) audioCue = pickFormCue("Side Plank", "hips_down");
    else if (!isBodyStraight) audioCue = pickFormCue("Side Plank", "dont_pike");
    return { newPhase: "hold", repCounted: false, repQuality: null, formScore, audioCue, isHoldActive };
  },
};

const DEAD_BUG: ExerciseConfig = {
  displayName: "Dead Bug",
  isStatic: false,
  difficultyWeight: 1.0,
  criticalJoints: [
    { label: "Knee angle (working leg)", description: "Lower the extended leg to near-floor level while keeping lower back flat." },
    { label: "Hip stability", description: "Hips must not rock — press your lumbar spine into the floor." },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const kneeAngle = calcAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;
    if (phase === "up" && kneeAngle > 145) newPhase = "down";
    else if (phase === "down" && kneeAngle < 100) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }
    const hipDiff     = Math.abs(lm[LM.LEFT_HIP].y - lm[LM.RIGHT_HIP].y);
    const rockPenalty = clamp(hipDiff * 200, 0, 40);
    const formScore   = clamp(100 - rockPenalty, 0, 100);
    const audioCue    = rockPenalty > 20 ? pickFormCue("Dead Bug", "dont_rock") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const SUPERMAN: ExerciseConfig = {
  displayName: "Superman",
  isStatic: false,
  difficultyWeight: 1.0,
  criticalJoints: [
    { label: "Shoulder elevation", description: "Raise chest and arms off the floor simultaneously." },
    { label: "Ankle elevation", description: "Legs should lift simultaneously with the upper body." },
  ],
  initialPhase: "down",
  processFrame(lm, phase) {
    const shoulderMid   = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid        = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const ankleMid      = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);
    const shoulderRaise = hipMid.y - shoulderMid.y;
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;
    if (phase === "down" && shoulderRaise > 0.06) newPhase = "up";
    else if (phase === "up" && shoulderRaise < 0.02) {
      newPhase = "down"; repCounted = true; repQuality = "complete";
    }
    const ankleRaise      = hipMid.y - ankleMid.y;
    const symmetryPenalty = clamp(Math.abs(shoulderRaise - ankleRaise) * 200, 0, 40);
    const formScore       = clamp(100 - symmetryPenalty, 0, 100);
    const audioCue = formScore < 65 ? pickFormCue("Superman", "lift_symmetrically") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const DRAGON_FLAG_NEGATIVE: ExerciseConfig = {
  displayName: "Dragon Flag Negative",
  isStatic: false,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Shoulder–Hip–Ankle straight line", description: "Body must stay perfectly straight throughout the descent — no pike." },
    { label: "Descent control", description: "Lower your body as slowly as possible." },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const shoulderMid   = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid        = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const ankleMid      = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);
    const bodyTiltDiff  = shoulderMid.y - ankleMid.y;
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;
    if (phase === "up" && Math.abs(bodyTiltDiff) < 0.08) {
      newPhase = "down"; repCounted = true; repQuality = "complete";
    } else if (phase === "down" && Math.abs(bodyTiltDiff) > 0.15) {
      newPhase = "up";
    }
    const bodyAngle       = calcAngle(shoulderMid, hipMid, ankleMid);
    const straightPenalty = clamp(Math.abs(180 - bodyAngle) * 2.5, 0, 50);
    const formScore       = clamp(100 - straightPenalty, 0, 100);
    const audioCue = formScore < 65 ? pickFormCue("Dragon Flag Negative", "dont_pike") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const ACTIVE_HANG: ExerciseConfig = {
  displayName: "Active Hang",
  isStatic: true,
  difficultyWeight: 1.0,
  criticalJoints: [
    { label: "Shoulder depression", description: "Actively pull your shoulder blades down — don't just hang passively." },
    { label: "Elbow straightness", description: "Keep elbows fully locked throughout the hold." },
  ],
  initialPhase: "hold",
  processFrame(lm) {
    const elbowAngle        = calcAngle(lm[LM.LEFT_WRIST], lm[LM.LEFT_ELBOW], lm[LM.LEFT_SHOULDER]);
    const wristMid          = midpoint(lm[LM.LEFT_WRIST], lm[LM.RIGHT_WRIST]);
    const shoulderMid       = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const shoulderDepressed = wristMid.y - shoulderMid.y;
    const isShoulderActive  = shoulderDepressed > 0.15;
    const isElbowsExtended  = elbowAngle > 155;
    const isHoldActive      = isShoulderActive && isElbowsExtended;
    const depressionScore   = clamp(shoulderDepressed * 200, 0, 50);
    const elbowPenalty      = clamp((160 - elbowAngle) * 1.5, 0, 40);
    const formScore         = clamp(50 + depressionScore - elbowPenalty, 0, 100);
    let audioCue: string | null = null;
    if (!isElbowsExtended) audioCue = pickFormCue("Active Hang", "arms_bent");
    else if (!isShoulderActive) audioCue = pickFormCue("Active Hang", "no_shoulder_depression");
    return { newPhase: "hold", repCounted: false, repQuality: null, formScore, audioCue, isHoldActive };
  },
};

const HANGING_KNEE_TUCK: ExerciseConfig = {
  displayName: "Hanging Knee Tuck",
  isStatic: false,
  difficultyWeight: 1.0,
  criticalJoints: [
    { label: "Hip–Knee angle (knees to chest)", description: "Drive knees as high as possible toward the chest." },
    { label: "Swing control", description: "Keep arms straight and movement strict." },
  ],
  initialPhase: "bottom",
  processFrame(lm, phase) {
    const kneeMid     = midpoint(lm[LM.LEFT_KNEE], lm[LM.RIGHT_KNEE]);
    const hipMid      = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const kneesAboveHips = kneeMid.y < hipMid.y;
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;
    if (phase === "bottom" && kneesAboveHips) newPhase = "top";
    else if (phase === "top" && !kneesAboveHips) {
      newPhase = "bottom"; repCounted = true; repQuality = "complete";
    }
    const swingPenalty = clamp(Math.abs(hipMid.x - shoulderMid.x) * 80, 0, 30);
    const tuckedBonus  = kneesAboveHips ? 20 : 0;
    const formScore    = clamp(80 + tuckedBonus - swingPenalty, 0, 100);
    const audioCue = swingPenalty > 15 ? pickFormCue("Hanging Knee Tuck", "swinging") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const HANGING_LEG_RAISE: ExerciseConfig = {
  displayName: "Hanging Leg Raise",
  isStatic: false,
  difficultyWeight: 3.0,
  criticalJoints: [
    { label: "Leg height (straight legs horizontal)", description: "Raise straight legs to horizontal — hips must not pike excessively." },
    { label: "Swing control", description: "No kipping or swinging." },
  ],
  initialPhase: "bottom",
  processFrame(lm, phase) {
    const hipMid      = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const ankleMid    = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const anklesAtHipLevel = ankleMid.y <= hipMid.y + 0.05;
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;
    if (phase === "bottom" && anklesAtHipLevel) newPhase = "top";
    else if (phase === "top" && !anklesAtHipLevel) {
      newPhase = "bottom"; repCounted = true; repQuality = "complete";
    }
    const kneeAngle    = calcAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]);
    const bentPenalty  = kneeAngle < 150 ? 20 : 0;
    const swingPenalty = clamp(Math.abs(hipMid.x - shoulderMid.x) * 80, 0, 25);
    const formScore    = clamp(100 - swingPenalty - bentPenalty, 0, 100);
    let audioCue: string | null = null;
    if (kneeAngle < 150) audioCue = pickFormCue("Hanging Leg Raise", "legs_straight");
    else if (swingPenalty > 15) audioCue = pickFormCue("Hanging Leg Raise", "swinging");
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const TOES_TO_BAR: ExerciseConfig = {
  displayName: "Toes to Bar",
  isStatic: false,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Ankle y vs Wrist y", description: "Toes must touch the bar — ankle reaches wrist level." },
    { label: "Swing control", description: "Full fold from a controlled hang — no excessive kip." },
  ],
  initialPhase: "bottom",
  processFrame(lm, phase) {
    const wristMid        = midpoint(lm[LM.LEFT_WRIST], lm[LM.RIGHT_WRIST]);
    const ankleMid        = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);
    const hipMid          = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const shoulderMid     = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const toesTouchingBar = ankleMid.y <= wristMid.y + 0.05;
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;
    if (phase === "bottom" && toesTouchingBar) newPhase = "top";
    else if (phase === "top" && !toesTouchingBar) {
      newPhase = "bottom"; repCounted = true; repQuality = "complete";
    }
    const swingPenalty    = clamp(Math.abs(hipMid.x - shoulderMid.x) * 80, 0, 30);
    const completionBonus = toesTouchingBar ? 20 : 0;
    const formScore       = clamp(80 + completionBonus - swingPenalty, 0, 100);
    const audioCue = swingPenalty > 15 ? pickFormCue("Toes to Bar", "swinging") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const WINDSHIELD_WIPER: ExerciseConfig = {
  displayName: "Windshield Wiper",
  isStatic: false,
  difficultyWeight: 3.0,
  criticalJoints: [
    { label: "Hip height (horizontal throughout)", description: "Hips must stay at or above shoulder level throughout the sweep." },
    { label: "Lateral ankle sweep", description: "Feet sweep side to side — full range of motion counts." },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const hipMid      = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const ankleMidX   = (lm[LM.LEFT_ANKLE].x + lm[LM.RIGHT_ANKLE].x) / 2;
    const lateralOffset = ankleMidX - shoulderMid.x;
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;
    if (phase === "up" && lateralOffset < -0.15) newPhase = "down";
    else if (phase === "down" && lateralOffset > 0.10) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }
    const hipsElevated = hipMid.y <= shoulderMid.y + 0.05;
    const dropPenalty  = hipsElevated ? 0 : 30;
    const formScore    = clamp(100 - dropPenalty, 0, 100);
    const audioCue = !hipsElevated ? pickFormCue("Windshield Wiper", "hips_down") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const TUCKED_HUMAN_FLAG: ExerciseConfig = {
  displayName: "Tucked Human Flag",
  isStatic: true,
  difficultyWeight: 3.0,
  criticalJoints: [
    { label: "Body horizontality (shoulder–hip)", description: "Shoulders and hips must be at the same height — body horizontal." },
    { label: "Arm structure", description: "Top arm pushes, bottom arm pulls. Both must be extended." },
  ],
  initialPhase: "hold",
  processFrame(lm) {
    const shoulderMid  = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid       = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const leftElbow    = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    const rightElbow   = calcAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]);
    const bodyTiltDiff  = Math.abs(shoulderMid.y - hipMid.y);
    const bodyTiltAngle = Math.atan(bodyTiltDiff) * (180 / Math.PI);
    const isBodyHorizontal = inZone(bodyTiltAngle, 0, 15);
    const isArmsExtended   = leftElbow > 130 && rightElbow > 130;
    const isHoldActive     = isBodyHorizontal && isArmsExtended;
    const tiltPenalty  = clamp(bodyTiltAngle * 4, 0, 50);
    const armPenalty   = clamp((140 - Math.min(leftElbow, rightElbow)) * 0.8, 0, 30);
    const formScore    = clamp(100 - tiltPenalty - armPenalty, 0, 100);
    let audioCue: string | null = null;
    if (!isArmsExtended) audioCue = pickFormCue("Tucked Human Flag", "arms_bent");
    else if (!isBodyHorizontal) audioCue = pickFormCue("Tucked Human Flag", "body_not_horizontal");
    return { newPhase: "hold", repCounted: false, repQuality: null, formScore, audioCue, isHoldActive };
  },
};

const ONE_LEG_HUMAN_FLAG: ExerciseConfig = {
  displayName: "One-Leg Human Flag",
  isStatic: true,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Body horizontality (shoulder–hip)", description: "Body must be horizontal with one leg extended." },
    { label: "Arm extension", description: "Both arms extended — top pushes, bottom pulls." },
  ],
  initialPhase: "hold",
  processFrame(lm) {
    const shoulderMid  = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid       = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const leftElbow    = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    const rightElbow   = calcAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]);
    const bodyTiltDiff  = Math.abs(shoulderMid.y - hipMid.y);
    const bodyTiltAngle = Math.atan(bodyTiltDiff) * (180 / Math.PI);
    const isBodyHorizontal = inZone(bodyTiltAngle, 0, 12);
    const isArmsExtended   = leftElbow > 135 && rightElbow > 135;
    const isHoldActive     = isBodyHorizontal && isArmsExtended;
    const tiltPenalty = clamp(bodyTiltAngle * 5, 0, 50);
    const armPenalty  = clamp((145 - Math.min(leftElbow, rightElbow)), 0, 35);
    const formScore   = clamp(100 - tiltPenalty - armPenalty, 0, 100);
    let audioCue: string | null = null;
    if (!isArmsExtended) audioCue = pickFormCue("One-Leg Human Flag", "arms_bent");
    else if (!isBodyHorizontal) audioCue = pickFormCue("One-Leg Human Flag", "body_not_horizontal");
    return { newPhase: "hold", repCounted: false, repQuality: null, formScore, audioCue, isHoldActive };
  },
};

const PIKE_STRETCH: ExerciseConfig = {
  displayName: "Pike Stretch",
  isStatic: true,
  difficultyWeight: 1.0,
  criticalJoints: [
    { label: "Fold depth (shoulder toward ankle)", description: "Legs stay straight while you fold forward — the deeper the better." },
    { label: "Knee straightness", description: "Do not bend the knees to reach further." },
  ],
  initialPhase: "hold",
  processFrame(lm) {
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const ankleMid    = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);
    const prongDiff   = Math.abs(shoulderMid.y - ankleMid.y);
    const depthScore  = clamp((0.3 - prongDiff) * 200, 0, 60);
    const kneeAngle   = calcAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]);
    const kneePenalty = clamp((180 - kneeAngle) * 1.5, 0, 40);
    const isHoldActive = prongDiff < 0.25 && kneeAngle > 150;
    const formScore   = clamp(40 + depthScore - kneePenalty, 0, 100);
    let audioCue: string | null = null;
    if (kneeAngle < 150) audioCue = pickFormCue("Pike Stretch", "legs_straight");
    else if (prongDiff > 0.25) audioCue = pickFormCue("Pike Stretch", "not_deep_enough");
    return { newPhase: "hold", repCounted: false, repQuality: null, formScore, audioCue, isHoldActive };
  },
};

const L_SIT_COMPRESSION: ExerciseConfig = {
  displayName: "L-Sit Compression",
  isStatic: false,
  difficultyWeight: 1.0,
  criticalJoints: [
    { label: "Hip angle (compression attempt)", description: "Drive your heels down into the floor to activate the hip flexors." },
    { label: "Spine alignment", description: "Sit tall — don't round your back." },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const hipAngle = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;
    if (phase === "up" && hipAngle < 75) newPhase = "down";
    else if (phase === "down" && hipAngle > 85) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }
    const shoulderMid    = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid         = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const torsoLean      = Math.abs(shoulderMid.x - hipMid.x);
    const roundingPenalty = clamp(torsoLean * 150, 0, 40);
    const formScore      = clamp(100 - roundingPenalty, 0, 100);
    const audioCue = roundingPenalty > 20 ? pickFormCue("L-Sit Compression", "sit_tall") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const L_SIT: ExerciseConfig = {
  displayName: "L-Sit",
  isStatic: true,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Hip elevation (above wrists)", description: "Hips must be raised clear of the surface — press through your arms." },
    { label: "Leg horizontality", description: "Legs must be parallel to the floor — not drooping." },
  ],
  initialPhase: "hold",
  processFrame(lm) {
    const wristMid      = midpoint(lm[LM.LEFT_WRIST], lm[LM.RIGHT_WRIST]);
    const hipMid        = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const ankleMid      = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);
    const leftElbow     = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    const rightElbow    = calcAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]);
    const avgElbow      = (leftElbow + rightElbow) / 2;
    const hipsElevated  = hipMid.y < wristMid.y;
    const legHorizontal = Math.abs(ankleMid.y - hipMid.y) < 0.12;
    const elbowsExtended = avgElbow > 145;
    const isHoldActive   = hipsElevated && legHorizontal && elbowsExtended;
    const hipLiftPenalty = hipsElevated ? 0 : clamp((wristMid.y - hipMid.y) * 300, 0, 40);
    const legDropPenalty = legHorizontal ? 0 : clamp(Math.abs(ankleMid.y - hipMid.y) * 200, 0, 40);
    const elbowPenalty   = clamp((150 - avgElbow) * 1.2, 0, 30);
    const formScore      = clamp(100 - hipLiftPenalty - legDropPenalty - elbowPenalty, 0, 100);
    let audioCue: string | null = null;
    if (!elbowsExtended) audioCue = pickFormCue("L-Sit", "arms_bent");
    else if (!hipsElevated) audioCue = pickFormCue("L-Sit", "no_shoulder_depression");
    else if (!legHorizontal) audioCue = pickFormCue("L-Sit", "legs_horizontal");
    return { newPhase: "hold", repCounted: false, repQuality: null, formScore, audioCue, isHoldActive };
  },
};

const STEP_UP: ExerciseConfig = {
  displayName: "Step-Up",
  isStatic: false,
  difficultyWeight: 1.0,
  criticalJoints: [
    { label: "Knee angle (leading leg)", description: "The working leg drives the movement — track knee flexion and extension." },
    { label: "Knee alignment", description: "Knee must track over the foot — don't let it cave inward." },
  ],
  initialPhase: "down",
  processFrame(lm, phase) {
    const kneeAngle = calcAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;
    if (phase === "down" && kneeAngle < 120) newPhase = "up";
    else if (phase === "up" && kneeAngle > 155) {
      newPhase = "down"; repCounted = true; repQuality = "complete";
    }
    const kneeDrift   = Math.abs(lm[LM.LEFT_KNEE].x - lm[LM.LEFT_ANKLE].x) * 100;
    const kneePenalty = clamp(kneeDrift, 0, 40);
    const formScore   = clamp(100 - kneePenalty, 0, 100);
    const audioCue = kneePenalty > 20 ? pickFormCue("Step-Up", "knees_caving") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const ASSISTED_PISTOL_SQUAT: ExerciseConfig = {
  displayName: "Assisted Pistol Squat",
  isStatic: false,
  difficultyWeight: 1.0,
  criticalJoints: [
    { label: "Working knee angle", description: "Deep single-leg squat — working knee must break 90°." },
    { label: "Free leg extension", description: "Keep the non-working leg extended forward throughout." },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const kneeAngle = calcAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;
    if (phase === "up" && kneeAngle < 90) newPhase = "down";
    else if (phase === "down" && kneeAngle > 150) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }
    const freeAnkleElevated = lm[LM.RIGHT_ANKLE].y < lm[LM.RIGHT_HIP].y + 0.1;
    const freePenalty = freeAnkleElevated ? 0 : 20;
    const formScore   = clamp(100 - freePenalty, 0, 100);
    const audioCue = !freeAnkleElevated ? pickFormCue("Assisted Pistol Squat", "free_leg_down") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const CLOSE_STANCE_SQUAT: ExerciseConfig = {
  displayName: "Close-Stance Squat",
  isStatic: false,
  difficultyWeight: 3.0,
  criticalJoints: [
    { label: "Knee angle (full depth required)", description: "Full depth required — break below 90° at the knee." },
    { label: "Foot position (feet together)", description: "Feet together demands ankle dorsiflexion — keep heels on the floor." },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const kneeAngle = calcAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;
    if (phase === "up" && kneeAngle < 90) newPhase = "down";
    else if (phase === "down" && kneeAngle > 155) {
      newPhase = "up"; repCounted = true;
      repQuality = lm[LM.LEFT_HIP].y < lm[LM.LEFT_KNEE].y ? "incomplete" : "complete";
    }
    const feetSpread    = Math.abs(lm[LM.LEFT_ANKLE].x - lm[LM.RIGHT_ANKLE].x);
    const stancePenalty = clamp(feetSpread * 100, 0, 30);
    const torsoAngle    = calcAngle(
      midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]),
      midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]),
      midpoint(lm[LM.LEFT_KNEE], lm[LM.RIGHT_KNEE]),
    );
    const torsoPenalty = clamp((90 - torsoAngle) * 1.2, 0, 40);
    const formScore    = clamp(100 - stancePenalty - torsoPenalty, 0, 100);
    let audioCue: string | null = null;
    if (repQuality === "incomplete") audioCue = pickFormCue("Close-Stance Squat", "not_deep_enough");
    else if (stancePenalty > 15) audioCue = pickFormCue("Close-Stance Squat", "core_loose");
    else if (formScore < 65) audioCue = pickFormCue("Close-Stance Squat", "chest_dropping");
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const TYPEWRITER_PULL_UP: ExerciseConfig = {
  displayName: "Typewriter Pull-Up",
  isStatic: false,
  difficultyWeight: 10.0,
  criticalJoints: [
    { label: "Wrist–Elbow–Shoulder", description: "Pull to bar then shift laterally — one hand approaches each shoulder alternately." },
    { label: "Hip control", description: "No swing — lateral shift is pure upper body." },
  ],
  initialPhase: "bottom",
  processFrame(lm, phase) {
    const leftElbow  = calcAngle(lm[LM.LEFT_WRIST], lm[LM.LEFT_ELBOW], lm[LM.LEFT_SHOULDER]);
    const rightElbow = calcAngle(lm[LM.RIGHT_WRIST], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_SHOULDER]);
    const avgElbow   = (leftElbow + rightElbow) / 2;
    const wristY     = (lm[LM.LEFT_WRIST].y + lm[LM.RIGHT_WRIST].y) / 2;
    const shoulderY  = (lm[LM.LEFT_SHOULDER].y + lm[LM.RIGHT_SHOULDER].y) / 2;
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;
    if (phase === "bottom" && wristY > shoulderY) newPhase = "top";
    else if (phase === "top" && avgElbow > 155) {
      newPhase = "bottom"; repCounted = true; repQuality = "complete";
    }
    const elbowDiff    = Math.abs(leftElbow - rightElbow);
    const lateralBonus = elbowDiff > 30 ? 10 : 0;
    const swingPenalty = clamp(Math.abs(midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]).x - midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]).x) * 80, 0, 25);
    const formScore    = clamp(90 + lateralBonus - swingPenalty, 0, 100);
    const audioCue = swingPenalty > 15 ? pickFormCue("Typewriter Pull-Up", "swinging") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const RING_SUPPORT_HOLD: ExerciseConfig = {
  displayName: "Ring Support Hold",
  isStatic: true,
  difficultyWeight: 3.0,
  criticalJoints: [
    { label: "Hip elevation above wrists", description: "Body upright on the rings — hips above wrist level." },
    { label: "Elbow lock-out", description: "Arms fully extended — no elbow bend." },
  ],
  initialPhase: "hold",
  processFrame(lm) {
    const wristMid      = midpoint(lm[LM.LEFT_WRIST], lm[LM.RIGHT_WRIST]);
    const hipMid        = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const leftElbow     = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    const rightElbow    = calcAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]);
    const avgElbow      = (leftElbow + rightElbow) / 2;
    const hipsElevated     = hipMid.y < wristMid.y;
    const isElbowsExtended = avgElbow > 145;
    const isHoldActive     = hipsElevated && isElbowsExtended;
    const hipPenalty   = hipsElevated ? 0 : clamp((wristMid.y - hipMid.y) * 300, 0, 50);
    const elbowPenalty = clamp((155 - avgElbow) * 1.2, 0, 40);
    const formScore    = clamp(100 - hipPenalty - elbowPenalty, 0, 100);
    let audioCue: string | null = null;
    if (!isElbowsExtended) audioCue = pickFormCue("Ring Support Hold", "arms_bent");
    else if (!hipsElevated) audioCue = pickFormCue("Ring Support Hold", "no_shoulder_depression");
    return { newPhase: "hold", repCounted: false, repQuality: null, formScore, audioCue, isHoldActive };
  },
};

const RING_PULL_UP: ExerciseConfig = {
  displayName: "Ring Pull-Up",
  isStatic: false,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Wrist–Elbow–Shoulder", description: "Same as bar pull-up — dead hang to chin over rings." },
    { label: "Ring symmetry", description: "Pull evenly — don't let one side dominate." },
  ],
  initialPhase: "bottom",
  processFrame(lm, phase) {
    const wristY     = lm[LM.LEFT_WRIST].y;
    const shoulderY  = lm[LM.LEFT_SHOULDER].y;
    const elbowAngle = calcAngle(lm[LM.LEFT_WRIST], lm[LM.LEFT_ELBOW], lm[LM.LEFT_SHOULDER]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;
    if (phase === "bottom" && wristY > shoulderY) newPhase = "top";
    else if (phase === "top" && elbowAngle > 160) {
      newPhase = "bottom"; repCounted = true; repQuality = "complete";
    }
    const leftElbow    = calcAngle(lm[LM.LEFT_WRIST], lm[LM.LEFT_ELBOW], lm[LM.LEFT_SHOULDER]);
    const rightElbow   = calcAngle(lm[LM.RIGHT_WRIST], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_SHOULDER]);
    const asymmetry    = clamp(Math.abs(leftElbow - rightElbow) * 0.5, 0, 25);
    const swingPenalty = clamp(Math.abs(midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]).x - midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]).x) * 80, 0, 20);
    const formScore    = clamp(100 - asymmetry - swingPenalty, 0, 100);
    let audioCue: string | null = null;
    if (asymmetry > 15) audioCue = pickFormCue("Ring Pull-Up", "pull_evenly");
    else if (swingPenalty > 12) audioCue = pickFormCue("Ring Pull-Up", "swinging");
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const RING_MUSCLE_UP: ExerciseConfig = {
  displayName: "Ring Muscle-Up",
  isStatic: false,
  difficultyWeight: 10.0,
  criticalJoints: [
    { label: "Wrist y vs Shoulder y (transition)", description: "Wrists must clear shoulder level in the pull phase." },
    { label: "Shoulder–Elbow–Wrist (press phase)", description: "Full elbow extension at the top of the press-out." },
  ],
  initialPhase: "bottom",
  processFrame(lm, phase) {
    const elbowAngle = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    const wristY     = (lm[LM.LEFT_WRIST].y + lm[LM.RIGHT_WRIST].y) / 2;
    const shoulderY  = (lm[LM.LEFT_SHOULDER].y + lm[LM.RIGHT_SHOULDER].y) / 2;
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;
    if (phase === "bottom" && wristY > shoulderY) newPhase = "top";
    else if (phase === "top" && elbowAngle > 155 && shoulderY > wristY + 0.05) {
      newPhase = "bottom"; repCounted = true; repQuality = "complete";
    }
    const lockScore    = clamp((elbowAngle / 160) * 70, 0, 70);
    const swingPenalty = clamp(Math.abs(midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]).x - midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]).x) * 80, 0, 30);
    const formScore    = clamp(lockScore + 30 - swingPenalty, 0, 100);
    const audioCue = formScore < 65 ? pickFormCue("Ring Muscle-Up", "no_full_extension") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const RING_DIP: ExerciseConfig = {
  displayName: "Ring Dip",
  isStatic: false,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Shoulder–Elbow–Wrist", description: "Elbow angle drives rep counting — same as bar dip but on rings." },
    { label: "Ring symmetry", description: "Press evenly — rings demand bilateral control." },
  ],
  initialPhase: "up",
  processFrame(lm, phase, equipment) {
    const elbowAngle = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;
    if (phase === "up" && elbowAngle < 90) newPhase = "down";
    else if (phase === "down" && elbowAngle > (equipment?.pushDepthThreshold ?? 150)) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }
    const leftElbow  = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    const rightElbow = calcAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]);
    const asymmetry  = clamp(Math.abs(leftElbow - rightElbow) * 0.6, 0, 30);
    const formScore  = clamp(100 - asymmetry, 0, 100);
    const audioCue = asymmetry > 20 ? pickFormCue("Ring Dip", "press_evenly") : formScore < 65 ? pickFormCue("Ring Dip", "elbows_flaring") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const WEIGHTED_PULL_UP: ExerciseConfig = {
  displayName: "Weighted Pull-Up",
  isStatic: false,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Full dead-hang to chin-over-bar", description: "Stricter form required with additional load." },
    { label: "Swing control", description: "Extra weight amplifies swing — keep the pull strictly vertical." },
  ],
  initialPhase: "bottom",
  processFrame(lm, phase) {
    const elbowAngle = calcAngle(lm[LM.LEFT_WRIST], lm[LM.LEFT_ELBOW], lm[LM.LEFT_SHOULDER]);
    const wristY     = lm[LM.LEFT_WRIST].y;
    const shoulderY  = lm[LM.LEFT_SHOULDER].y;
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;
    if (phase === "bottom" && wristY > shoulderY) newPhase = "top";
    else if (phase === "top" && elbowAngle > 160) {
      newPhase = "bottom"; repCounted = true; repQuality = "complete";
    }
    const swingPenalty = clamp(Math.abs(midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]).x - midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]).x) * 100, 0, 30);
    const formScore    = clamp(100 - swingPenalty, 0, 100);
    const audioCue = formScore < 65 ? pickFormCue("Weighted Pull-Up", "swinging") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const WEIGHTED_MUSCLE_UP: ExerciseConfig = {
  displayName: "Weighted Muscle-Up",
  isStatic: false,
  difficultyWeight: 10.0,
  criticalJoints: [
    { label: "Wrist y vs Shoulder y transition", description: "Full muscle-up with added weight." },
    { label: "Press-out lock-out", description: "Full elbow extension at the top — especially important under load." },
  ],
  initialPhase: "bottom",
  processFrame(lm, phase) {
    const elbowAngle = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    const wristY     = (lm[LM.LEFT_WRIST].y + lm[LM.RIGHT_WRIST].y) / 2;
    const shoulderY  = (lm[LM.LEFT_SHOULDER].y + lm[LM.RIGHT_SHOULDER].y) / 2;
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;
    if (phase === "bottom" && wristY > shoulderY) newPhase = "top";
    else if (phase === "top" && elbowAngle > 155 && shoulderY > wristY + 0.05) {
      newPhase = "bottom"; repCounted = true; repQuality = "complete";
    }
    const lockScore    = clamp((elbowAngle / 160) * 70, 0, 70);
    const swingPenalty = clamp(Math.abs(midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]).x - midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]).x) * 80, 0, 30);
    const formScore    = clamp(lockScore + 30 - swingPenalty, 0, 100);
    const audioCue = formScore < 65 ? pickFormCue("Weighted Muscle-Up", "no_full_extension") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

const WEIGHTED_DIP: ExerciseConfig = {
  displayName: "Weighted Dip",
  isStatic: false,
  difficultyWeight: 5.0,
  criticalJoints: [
    { label: "Shoulder–Elbow–Wrist", description: "Elbow angle drives rep counting. Elbows stay tucked with added load." },
    { label: "Torso lean", description: "Controlled lean — extra weight increases instability." },
  ],
  initialPhase: "up",
  processFrame(lm, phase, equipment) {
    const elbowAngle = calcAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;
    if (phase === "up" && elbowAngle < 90) newPhase = "down";
    else if (phase === "down" && elbowAngle > (equipment?.pushDepthThreshold ?? 150)) {
      newPhase = "up"; repCounted = true; repQuality = "complete";
    }
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid      = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const bodyLean    = Math.abs(shoulderMid.x - hipMid.x) * 100;
    const formScore   = clamp(100 - Math.max(0, bodyLean - 5) * 2, 0, 100);
    const audioCue = formScore < 60 ? pickFormCue("Weighted Dip", "elbows_flaring") : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── Difficulty Weight Registry ───────────────────────────────────────────────
// Canonical map of exercise name → leaderboard difficulty weight.
// Points per rep (or per second for static holds) = weight × (formScore / 100).
// Only AI-verified sessions earn leaderboard points.
// Tiers: Beginner=1.0 · Intermediate=3.0 · Advanced=5.0 · Elite=10.0

export const DIFFICULTY_WEIGHTS: Record<string, number> = {
  // ── Beginner (1.0) ──────────────────────────────────────────────────────────
  "Wall Push-Up":           1.0,
  "Incline Push-Up":        1.0,
  "Knee Push-Up":           1.0,
  "Assisted Squat":         1.0,
  "Scapular Shrugs":        1.0,
  "Negative Pull-Ups":      1.0,
  "Negative Pull-Up":       1.0,
  "Plank":                  1.0,
  "Side Plank":             1.0,
  "Dead Bug":               1.0,
  "Superman":               1.0,
  "Active Hang":            1.0,
  "Hanging Knee Tuck":      1.0,
  "Pike Stretch":           1.0,
  "L-Sit Compression":      1.0,
  "Planche Lean":           1.0,
  "Step-Up":                1.0,
  "Assisted Pistol Squat":  1.0,
  // ── Intermediate (3.0) ──────────────────────────────────────────────────────
  "Push-Up":                3.0,
  "Diamond Push-Up":        3.0,
  "Pike Push-Up":           3.0,
  "Australian Rows":        3.0,
  "Pull-Up":                3.0,
  "Dip":                    3.0,
  "Squat":                  3.0,
  "Lunge":                  3.0,
  "Burpee":                 3.0,
  "Hollow Body Hold":       3.0,
  "Tuck Front Lever":       3.0,
  "Bulgarian Split Squat":  3.0,
  "Chest-to-Bar Pull-Up":   3.0,
  "Tuck Planche":           3.0,
  "Windshield Wiper":       3.0,
  "Tucked Human Flag":      3.0,
  "Ring Support Hold":      3.0,
  "Close-Stance Squat":     3.0,
  "Hanging Leg Raise":      3.0,
  // ── Advanced (5.0) ──────────────────────────────────────────────────────────
  "Elevated Pike Push-Up":  5.0,
  "Explosive Pull-Up":      5.0,
  "Archer Pull-Up":         5.0,
  "Tuck L-Sit":             5.0,
  "Straddle Front Lever":   5.0,
  "Dragon Flag":            5.0,
  "Dragon Flag Negative":   5.0,
  "Archer Squat":           5.0,
  "Nordic Curls":           5.0,
  "Shrimp Squat":           5.0,
  "Pistol Squat":           5.0,
  "Handstand":              5.0,
  "Straddle Planche":       5.0,
  "One-Leg Human Flag":     5.0,
  "Toes to Bar":            5.0,
  "L-Sit":                  5.0,
  "Archer Push-Up":         5.0,
  "Pseudo Planche Push-Up": 5.0,
  "Ring Pull-Up":           5.0,
  "Ring Dip":               5.0,
  "Weighted Pull-Up":       5.0,
  "Weighted Dip":           5.0,
  // ── Elite (10.0) ────────────────────────────────────────────────────────────
  "Handstand Push-Up":      10.0,
  "Muscle-Up":              10.0,
  "Full Front Lever":       10.0,
  "Human Flag":             10.0,
  "Planche":                10.0,
  "Ring Muscle-Up":         10.0,
  "Weighted Muscle-Up":     10.0,
  "Typewriter Pull-Up":     10.0,
};

export type DifficultyTier = "Beginner" | "Intermediate" | "Advanced" | "Elite";

export const TIER_COLOR: Record<DifficultyTier, string> = {
  Beginner:     "#6b7280",
  Intermediate: "#3b82f6",
  Advanced:     "#f97316",
  Elite:        "#eab308",
};

/** Returns the difficulty tier label for a given weight. */
export function getDifficultyTier(weight: number): DifficultyTier {
  if (weight >= 10) return "Elite";
  if (weight >= 5)  return "Advanced";
  if (weight >= 3)  return "Intermediate";
  return "Beginner";
}

/** Case-insensitive difficulty weight lookup. Returns 1.0 for unknown exercises. */
export function getDifficultyWeight(exerciseName: string): number {
  const key = Object.keys(DIFFICULTY_WEIGHTS).find(
    (k) => k.toLowerCase() === exerciseName.toLowerCase(),
  );
  return key ? DIFFICULTY_WEIGHTS[key] : 1.0;
}

// ─── Registry & lookup ────────────────────────────────────────────────────────

export const EXERCISE_REGISTRY: Record<string, ExerciseConfig> = {
  // ── PUSH — Main ─────────────────────────────────────────────────────────────
  "Wall Push-Up":            WALL_PUSH_UP,
  "Incline Push-Up":         INCLINE_PUSH_UP,
  "Knee Push-Up":            KNEE_PUSH_UP,
  "Push-Up":                 PUSH_UP,
  "Diamond Push-Up":         DIAMOND_PUSH_UP,
  "Archer Push-Up":          ARCHER_PUSH_UP,
  "Pseudo Planche Push-Up":  PSEUDO_PLANCHE_PUSH_UP,
  // ── PUSH — Overhead Path ────────────────────────────────────────────────────
  "Pike Push-Up":            PIKE_PUSH_UP,
  "Elevated Pike Push-Up":   ELEVATED_PIKE_PUSH_UP,
  "Handstand Push-Up":       HANDSTAND_PUSH_UP,
  "Handstand":               HANDSTAND,
  // ── PUSH — Planche Path ─────────────────────────────────────────────────────
  "Planche Lean":            PLANCHE_LEAN,
  "Tuck Planche":            TUCK_PLANCHE,
  "Straddle Planche":        STRADDLE_PLANCHE,
  "Planche":                 PLANCHE,
  // ── PULL — Foundation ───────────────────────────────────────────────────────
  "Scapular Shrugs":         SCAPULAR_SHRUGS,
  "Australian Rows":         AUSTRALIAN_ROWS,
  "Negative Pull-Ups":       NEGATIVE_PULL_UPS,
  "Negative Pull-Up":        NEGATIVE_PULL_UPS,
  "Pull-Up":                 PULL_UP,
  // ── PULL — Front Lever Path ─────────────────────────────────────────────────
  "Tuck Front Lever":        TUCK_FRONT_LEVER,
  "Straddle Front Lever":    STRADDLE_FRONT_LEVER,
  "Full Front Lever":        FULL_FRONT_LEVER,
  // ── PULL — Muscle-Up Path ───────────────────────────────────────────────────
  "Explosive Pull-Up":       EXPLOSIVE_PULL_UP,
  "Chest-to-Bar Pull-Up":    CHEST_TO_BAR_PULL_UP,
  "Muscle-Up":               MUSCLE_UP,
  // ── PULL — Advanced Moves ───────────────────────────────────────────────────
  "Archer Pull-Up":          ARCHER_PULL_UP,
  "Typewriter Pull-Up":      TYPEWRITER_PULL_UP,
  // ── PULL — Ring Specialty ───────────────────────────────────────────────────
  "Ring Support Hold":       RING_SUPPORT_HOLD,
  "Ring Pull-Up":            RING_PULL_UP,
  "Ring Muscle-Up":          RING_MUSCLE_UP,
  // ── PUSH — Ring / Weighted Specialty ────────────────────────────────────────
  "Ring Dip":                RING_DIP,
  "Weighted Pull-Up":        WEIGHTED_PULL_UP,
  "Weighted Muscle-Up":      WEIGHTED_MUSCLE_UP,
  "Weighted Dip":            WEIGHTED_DIP,
  // ── CORE — Main ─────────────────────────────────────────────────────────────
  "Plank":                   PLANK,
  "Side Plank":              SIDE_PLANK,
  // ── CORE — Hollow Holds Path ────────────────────────────────────────────────
  "Dead Bug":                DEAD_BUG,
  "Superman":                SUPERMAN,
  "Hollow Body Hold":        HOLLOW_BODY_HOLD,
  "Dragon Flag Negative":    DRAGON_FLAG_NEGATIVE,
  "Dragon Flag":             DRAGON_FLAG,
  // ── CORE — Bar Based Path ───────────────────────────────────────────────────
  "Active Hang":             ACTIVE_HANG,
  "Hanging Knee Tuck":       HANGING_KNEE_TUCK,
  "Hanging Leg Raise":       HANGING_LEG_RAISE,
  "Toes to Bar":             TOES_TO_BAR,
  // ── CORE — Human Flag Path ──────────────────────────────────────────────────
  "Windshield Wiper":        WINDSHIELD_WIPER,
  "Tucked Human Flag":       TUCKED_HUMAN_FLAG,
  "One-Leg Human Flag":      ONE_LEG_HUMAN_FLAG,
  "Human Flag":              HUMAN_FLAG,
  // ── LEGS — Main ─────────────────────────────────────────────────────────────
  "Assisted Squat":          ASSISTED_SQUAT,
  "Squat":                   SQUAT,
  "Archer Squat":            ARCHER_SQUAT,
  "Shrimp Squat":            SHRIMP_SQUAT,
  "Bulgarian Split Squat":   BULGARIAN_SPLIT_SQUAT,
  "Nordic Curls":            NORDIC_CURLS,
  // ── LEGS — L-Sit Path ───────────────────────────────────────────────────────
  "Pike Stretch":            PIKE_STRETCH,
  "L-Sit Compression":       L_SIT_COMPRESSION,
  "Tuck L-Sit":              TUCK_L_SIT,
  "L-Sit":                   L_SIT,
  // ── LEGS — Pistol Squat Path ────────────────────────────────────────────────
  "Step-Up":                 STEP_UP,
  "Assisted Pistol Squat":   ASSISTED_PISTOL_SQUAT,
  "Close-Stance Squat":      CLOSE_STANCE_SQUAT,
  "Pistol Squat":            PISTOL_SQUAT,
  // ── Other ───────────────────────────────────────────────────────────────────
  "Dip":                     DIP,
  "Lunge":                   LUNGE,
  "Burpee":                  BURPEE,
};

/**
 * Case-insensitive lookup. Returns null when no entry matches.
 */
export function getExerciseConfig(name: string): ExerciseConfig | null {
  const key = Object.keys(EXERCISE_REGISTRY).find(
    (k) => k.toLowerCase() === name.toLowerCase(),
  );
  return key ? EXERCISE_REGISTRY[key] : null;
}

// ── Visibility Guard — required landmark sets by movement category ─────────
// All indices follow the MediaPipe 33-keypoint model.

const PUSH_REQUIRED_LM = [
  LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER,
  LM.LEFT_ELBOW,    LM.RIGHT_ELBOW,
  LM.LEFT_WRIST,    LM.RIGHT_WRIST,
  LM.LEFT_HIP,      LM.RIGHT_HIP,
] as const;

const LEG_REQUIRED_LM = [
  LM.LEFT_HIP,   LM.RIGHT_HIP,
  LM.LEFT_KNEE,  LM.RIGHT_KNEE,
  LM.LEFT_ANKLE, LM.RIGHT_ANKLE,
] as const;

const CORE_REQUIRED_LM = [
  LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER,
  LM.LEFT_HIP,      LM.RIGHT_HIP,
] as const;

/**
 * Returns the MediaPipe landmark indices that must all meet the visibility
 * threshold (default 0.65) before rep counting and Ghost Sync activate.
 * Used by the Visibility Guard in the workout page.
 */
export function getRequiredLandmarks(exerciseName: string): readonly number[] {
  const n = exerciseName.toLowerCase();

  if (
    n.includes("squat")   || n.includes("lunge")   || n.includes("pistol") ||
    n.includes("knee")    || n.includes("jump")     || n.includes("calf")   ||
    n.includes("nordic")  || n.includes("ankle")    || n.includes("glute")  ||
    n.includes("leg raise")
  ) {
    return LEG_REQUIRED_LM;
  }

  if (
    n.includes("push")      || n.includes("dip")       || n.includes("handstand") ||
    n.includes("planche")   || n.includes("press")     || n.includes("tricep")    ||
    n.includes("burpee")    || n.includes("pull")       || n.includes("chin")      ||
    n.includes("row")       || n.includes("curl")       || n.includes("bicep")     ||
    n.includes("lever")     || n.includes("hang")       || n.includes("muscle up") ||
    n.includes("muscle-up")
  ) {
    return PUSH_REQUIRED_LM;
  }

  return CORE_REQUIRED_LM;
}
