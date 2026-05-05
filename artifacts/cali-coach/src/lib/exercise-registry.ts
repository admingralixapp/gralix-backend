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
function calcAngle(a: Landmark, b: Landmark, c: Landmark): number {
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
    const audioCue = formScore < 70 ? "Keep your elbows pointed down, not flaring" : null;
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
        ? "Keep your hips down — straight line from head to heels"
        : "Hips are dropping — tighten your core";
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
        ? "Lower your hips — keep a straight line from shoulder to knee"
        : "Hips sagging — squeeze your glutes";
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
        audioCue = "Elbows are flaring — tuck them in";
      } else if (hipMid.y > ankleMid.y * 0.98) {
        audioCue = "Hips are sagging — squeeze your core";
      } else {
        audioCue = "Straight line — head to heels";
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
    if (flarePenalty > bodyPenalty && formScore < 65) audioCue = "Keep elbows tucked — they should graze your sides";
    else if (formScore < 60) audioCue = "Hold the plank — core tight";
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
    const audioCue = formScore < 65 ? "Stack your hips over your wrists — tighten your core" : null;
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
    const audioCue = formScore < 65 ? "Keep arms straight — only move your shoulder blades" : null;
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
    const audioCue = formScore < 60 ? "Keep your hips up — rigid body from head to heels" : null;
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
    const audioCue = formScore < 65 ? "Control the descent — no swinging" : null;
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
        audioCue = "Get your chin over the bar";
      } else if (swingPenalty > symmetryPenalty) {
        audioCue = "Stop the swinging — use your back";
      } else {
        audioCue = "Pull evenly — engage your lats";
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

    const audioCue = formScore < 65 ? "Pull from the lats — less swing, more power" : null;
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
        ? "Drive through — press all the way to lockout"
        : "Less swing — use your lats to initiate";
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
    if (!isElbowsExtended) audioCue = "Lock your elbows out — arms fully straight";
    else if (!isBodyHorizontal) {
      audioCue = shoulderMid.y > hipMid.y
        ? "Lift your hips — body should be horizontal"
        : "Lower your hips — body should be horizontal";
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
    if (!isElbowsExtended) audioCue = "Extend your arms fully — elbows locked";
    else if (!isBodyHorizontal) {
      audioCue = shoulderMid.y > hipMid.y
        ? "Raise the hips — fight to keep them level"
        : "Drop the hips — match shoulder height";
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
    if (!isElbowsExtended) audioCue = "Fully lock out your elbows";
    else if (!isBodyHorizontal) audioCue = "Body must be perfectly horizontal — squeeze everything";

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
        ? "Don't pike — keep a rigid straight line from shoulder to ankle"
        : "Don't arch — squeeze abs and glutes";
    } else if (!isBodyHorizontal) {
      audioCue = "Hold it horizontal — fight gravity";
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
    if (!isArmsExtended) audioCue = "Lock out both arms — push and pull with max tension";
    else if (!isBodyHorizontal) audioCue = "Drive the hips up — body should be level";
    else if (!isBodyStraight) audioCue = "Squeeze your core — body straight as a board";

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
    const audioCue = formScore < 60 ? "Chest up — use your support and sit back" : null;
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
      audioCue = "Go deeper — hips must reach knee level";
    } else if (formScore < 60) {
      if (heelRise) {
        audioCue = "Weight on your heels — don't let them rise";
      } else if (forwardLean) {
        audioCue = "Chest up — don't lean forward";
      } else if (kneePenalty > torsoPenalty) {
        audioCue = "Knees out — don't let them cave inward";
      } else {
        audioCue = "Keep your chest up and spine neutral";
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
    if (extPenalty > torsoPenalty && formScore < 65) audioCue = "Straighten the extended leg — lock that knee out";
    else if (formScore < 60) audioCue = "Sink lower into the working leg";
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
    if (freeLegPenalty > 0 && formScore < 70) audioCue = "Extend your free leg forward — don't let it touch the ground";
    else if (formScore < 60) audioCue = "Sit all the way down — full depth pistol";
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
    if (formScore < 60) audioCue = "Don't break at the hips — lower as a rigid plank from knees to shoulders";

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
    if (hipAbove) audioCue = "Keep your hips down — squeeze your glutes";
    else if (hipBelow) audioCue = "Raise your hips — body should be straight";
    else if (formScore < 70) audioCue = "Hold your core tight";

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
    const audioCue = formScore < 60 ? "Control the descent — elbows tucked" : null;
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
    const audioCue = formScore < 60 ? "Torso upright — don't lean forward" : null;
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
    const audioCue = formScore < 60 ? "Explode up — full extension at the top" : null;
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
    if (phase === "top" && !chestClear) audioCue = "Drive your chest to the bar — pull higher";
    else if (swingPenalty > 15) audioCue = "Control the swing — pull straight up";
    else if (phase === "bottom" && elbowAngle < 150) audioCue = "Full dead hang — lock out your elbows";
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
    if (extPenalty > 20) audioCue = "Keep the extended arm locked out — straight as a rod";
    else if (swingPenalty > 15) audioCue = "Shift your weight fully onto the working arm";
    else if (formScore < 65) audioCue = "Pull your elbow to your hip on the working side";
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
    if (hipPenalty > 20) audioCue = "Pike your hips higher — form that inverted V shape";
    else if (formScore < 65) audioCue = "Lower your head between your hands";
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
    if (hipPenalty > 25) audioCue = "Keep hips elevated — this loads your shoulders";
    else if (formScore < 65) audioCue = "Lower until your head nearly touches the floor";
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
    if (!anklesElevated)    audioCue = "Raise your legs — keep them straight and together";
    else if (!shouldersElevated) audioCue = "Curl your shoulders off the floor — reach arms forward";
    else if (!isHorizontal) audioCue = "Keep your body long and horizontal — squeeze your core";
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
    if (!elbowsExtended)  audioCue = "Lock out your arms — press down through your palms";
    else if (!hipsElevated) audioCue = "Push the floor away — lift your hips off the surface";
    else if (!kneesTucked)  audioCue = "Tuck your knees tight to your chest";
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
    if (kneePenalty > torsoPenalty && formScore < 65) audioCue = "Keep your front knee tracking over your toes";
    else if (formScore < 60) audioCue = "Torso upright — sink straight down into the squat";
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
    if (repQuality === "incomplete")         audioCue = "Go deeper — full depth shrimp squat";
    else if (balancePenalty > 20 && formScore < 65) audioCue = "Stay balanced — keep your hip over your ankle";
    else if (formScore < 60)                 audioCue = "Control the descent — slow and steady";
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
  "Wall Push-Up":       1.0,
  "Incline Push-Up":    1.0,
  "Knee Push-Up":       1.0,
  "Assisted Squat":     1.0,
  "Scapular Shrugs":    1.0,
  "Negative Pull-Ups":  1.0,
  "Plank":              1.0,
  // ── Intermediate (3.0) ──────────────────────────────────────────────────────
  "Push-Up":            3.0,
  "Diamond Push-Up":    3.0,
  "Pike Push-Up":       3.0,
  "Australian Rows":    3.0,
  "Pull-Up":            3.0,
  "Dip":                3.0,
  "Squat":              3.0,
  "Lunge":              3.0,
  "Burpee":             3.0,
  "Hollow Body Hold":   3.0,
  "Tuck Front Lever":   3.0,
  "Bulgarian Split Squat": 3.0,
  "Chest-to-Bar Pull-Up":  3.0,
  // ── Advanced (5.0) ──────────────────────────────────────────────────────────
  "Elevated Pike Push-Up": 5.0,
  "Explosive Pull-Up":  5.0,
  "Archer Pull-Up":     5.0,
  "Tuck L-Sit":         5.0,
  "Straddle Front Lever": 5.0,
  "Dragon Flag":        5.0,
  "Archer Squat":       5.0,
  "Nordic Curls":       5.0,
  "Shrimp Squat":       5.0,
  "Pistol Squat":       5.0,
  // ── Elite (10.0) ────────────────────────────────────────────────────────────
  "Handstand Push-Up":  10.0,
  "Muscle-Up":          10.0,
  "Full Front Lever":   10.0,
  "Human Flag":         10.0,
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
  // Push progression
  "Wall Push-Up":       WALL_PUSH_UP,
  "Incline Push-Up":    INCLINE_PUSH_UP,
  "Knee Push-Up":       KNEE_PUSH_UP,
  "Push-Up":            PUSH_UP,
  "Diamond Push-Up":    DIAMOND_PUSH_UP,
  "Handstand Push-Up":  HANDSTAND_PUSH_UP,
  // Pull progression (shared)
  "Scapular Shrugs":    SCAPULAR_SHRUGS,
  "Australian Rows":    AUSTRALIAN_ROWS,
  "Negative Pull-Ups":  NEGATIVE_PULL_UPS,
  "Pull-Up":            PULL_UP,
  // Pull: Front Lever path (static)
  "Tuck Front Lever":     TUCK_FRONT_LEVER,
  "Straddle Front Lever": STRADDLE_FRONT_LEVER,
  "Full Front Lever":     FULL_FRONT_LEVER,
  // Pull: Muscle-Up path (explosive)
  "Explosive Pull-Up": EXPLOSIVE_PULL_UP,
  "Muscle-Up":         MUSCLE_UP,
  // Pull: Explosive Pull path
  "Chest-to-Bar Pull-Up": CHEST_TO_BAR_PULL_UP,
  "Archer Pull-Up":       ARCHER_PULL_UP,
  // Push: Overhead Pressing path
  "Pike Push-Up":          PIKE_PUSH_UP,
  "Elevated Pike Push-Up": ELEVATED_PIKE_PUSH_UP,
  // Core: Static Holds path
  "Hollow Body Hold": HOLLOW_BODY_HOLD,
  "Tuck L-Sit":       TUCK_L_SIT,
  // Legs: Unilateral path
  "Bulgarian Split Squat": BULGARIAN_SPLIT_SQUAT,
  "Shrimp Squat":          SHRIMP_SQUAT,
  // Legs progression
  "Assisted Squat": ASSISTED_SQUAT,
  "Squat":          SQUAT,
  "Archer Squat":   ARCHER_SQUAT,
  "Nordic Curls":   NORDIC_CURLS,
  "Pistol Squat":   PISTOL_SQUAT,
  // Core & other
  "Plank":       PLANK,
  "Dragon Flag": DRAGON_FLAG,
  "Human Flag":  HUMAN_FLAG,
  "Dip":         DIP,
  "Lunge":       LUNGE,
  "Burpee":      BURPEE,
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
