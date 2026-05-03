/**
 * ExerciseRegistry
 *
 * Single source of truth for:
 *   - Which joints are "Critical" for each movement
 *   - The per-exercise rep-counting state machine
 *   - Form scoring and audio cue logic
 *
 * All landmark indices follow the MediaPipe Pose 33-keypoint model.
 * https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
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
 *  "hold"   — static hold (plank)
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
}

export interface CriticalJoint {
  /** Human-readable name shown in the UI. */
  label: string;
  /** One-sentence description of why it matters. */
  description: string;
}

export interface ExerciseConfig {
  displayName: string;
  /** Joints the system actively tracks, scored, and highlighted. */
  criticalJoints: CriticalJoint[];
  initialPhase: Phase;
  processFrame(landmarks: Landmark[], currentPhase: Phase): FrameResult;
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

// ─── Push-Up ──────────────────────────────────────────────────────────────────
const PUSH_UP: ExerciseConfig = {
  displayName: "Push-Up",
  criticalJoints: [
    {
      label: "Shoulder–Elbow–Wrist",
      description: "Elbow angle drives rep counting. Lock out fully at the top.",
    },
    {
      label: "Shoulder–Hip–Ankle line",
      description: "Body must stay in a straight plank line throughout.",
    },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const elbowAngle = calcAngle(
      lm[LM.LEFT_SHOULDER],
      lm[LM.LEFT_ELBOW],
      lm[LM.LEFT_WRIST],
    );

    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "up" && elbowAngle < 90) {
      newPhase = "down";
    } else if (phase === "down" && elbowAngle > 150) {
      newPhase = "up";
      repCounted = true;
      repQuality = "complete";
    }

    // Body-line check: hips must not sag or pike
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const ankleMid = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);
    const bodyAngle = calcAngle(shoulderMid, hipMid, ankleMid);

    const formScore = clamp(100 - Math.max(0, 180 - bodyAngle) * 2.5, 0, 100);
    let audioCue: string | null = null;
    if (formScore < 60) {
      audioCue =
        hipMid.y < shoulderMid.y
          ? "Keep your hips down — maintain a straight line"
          : "Hips are dropping — tighten your core";
    }

    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── Squat ────────────────────────────────────────────────────────────────────
const SQUAT: ExerciseConfig = {
  displayName: "Squat",
  criticalJoints: [
    {
      label: "Hip–Knee–Ankle (primary)",
      description:
        "Knee angle drives rep counting. Must break 100° at the bottom for a full squat.",
    },
    {
      label: "Hip depth vs Knee height",
      description:
        "Rep is marked Incomplete if the hip y-coordinate is still higher than the knee at the bottom — meaning parallel was not reached.",
    },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const kneeAngle = calcAngle(
      lm[LM.LEFT_HIP],
      lm[LM.LEFT_KNEE],
      lm[LM.LEFT_ANKLE],
    );

    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "up" && kneeAngle < 100) {
      newPhase = "down";
    } else if (phase === "down" && kneeAngle > 160) {
      newPhase = "up";
      repCounted = true;

      // ── Completeness check ────────────────────────────────────────────────
      // MediaPipe y-coordinates are normalised 0 (top of image) → 1 (bottom).
      // A "higher" hip in screen-space means a SMALLER y value.
      // For a parallel squat the hip must descend AT LEAST to knee level,
      // so hip.y must be >= knee.y by the time the angle crosses 160° on the
      // way back up.  If hip.y < knee.y the rep is INCOMPLETE.
      const hipY = lm[LM.LEFT_HIP].y;
      const kneeY = lm[LM.LEFT_KNEE].y;
      repQuality = hipY < kneeY ? "incomplete" : "complete";
    }

    // Form score: torso upright + knees tracking over ankles
    const torsoAngle = calcAngle(
      midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]),
      midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]),
      midpoint(lm[LM.LEFT_KNEE], lm[LM.RIGHT_KNEE]),
    );
    const torsoPenalty = clamp((90 - torsoAngle) * 1.5, 0, 40);
    const kneeDrift = Math.abs(lm[LM.LEFT_KNEE].x - lm[LM.LEFT_ANKLE].x) * 100;
    const kneePenalty = clamp(kneeDrift, 0, 30);
    const formScore = clamp(100 - torsoPenalty - kneePenalty, 0, 100);

    let audioCue: string | null = null;
    if (repQuality === "incomplete") {
      audioCue = "Go deeper — hips must reach knee level";
    } else if (formScore < 60) {
      audioCue =
        kneePenalty > torsoPenalty
          ? "Knees out — don't let them cave inward"
          : "Keep your chest up and spine neutral";
    }

    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── Pull-Up ──────────────────────────────────────────────────────────────────
const PULL_UP: ExerciseConfig = {
  displayName: "Pull-Up",
  criticalJoints: [
    {
      label: "Wrist–Elbow–Shoulder (primary)",
      description:
        "Elbow angle must exceed 160° at the bottom for a dead-hang — confirming full extension before the next rep.",
    },
    {
      label: "Wrist y vs Shoulder y",
      description:
        "Rep top is recorded only when the wrist y-coordinate passes below the shoulder y-coordinate — meaning the body has risen enough for chin-over-bar.",
    },
  ],
  initialPhase: "bottom",
  processFrame(lm, phase) {
    const elbowAngle = calcAngle(
      lm[LM.LEFT_WRIST],
      lm[LM.LEFT_ELBOW],
      lm[LM.LEFT_SHOULDER],
    );

    // In normalised image coords y=0 is the top of the frame, y=1 the bottom.
    //
    // Dead-hang:  wrist (at bar) has a small y; shoulder hangs lower → wrist.y < shoulder.y
    // Chin-over:  body has risen; the shoulder has moved above bar level →
    //             shoulder.y < wrist.y  ⟺  wrist.y > shoulder.y
    //
    // So the TOP condition is:  wrist.y > shoulder.y
    // The BOTTOM condition is:  elbowAngle > 160° (full arm extension)
    const wristY = lm[LM.LEFT_WRIST].y;
    const shoulderY = lm[LM.LEFT_SHOULDER].y;

    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "bottom" && wristY > shoulderY) {
      newPhase = "top";
    } else if (phase === "top" && elbowAngle > 160) {
      newPhase = "bottom";
      repCounted = true;
      repQuality = "complete";
    }

    // Form: reward full ROM; penalise asymmetry and body swing
    const rightElbow = calcAngle(
      lm[LM.RIGHT_WRIST],
      lm[LM.RIGHT_ELBOW],
      lm[LM.RIGHT_SHOULDER],
    );
    const symmetryPenalty = clamp(Math.abs(rightElbow - elbowAngle) * 0.5, 0, 20);

    const hipMidX = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]).x;
    const shMidX = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]).x;
    const swingPenalty = clamp(Math.abs(hipMidX - shMidX) * 100, 0, 20);

    const extensionBonus = clamp((elbowAngle / 180) * 40, 0, 40);
    const formScore = clamp(60 + extensionBonus - symmetryPenalty - swingPenalty, 0, 100);

    let audioCue: string | null = null;
    if (formScore < 65) {
      audioCue =
        swingPenalty > symmetryPenalty
          ? "Engage your core — stop swinging"
          : "Pull evenly on both sides";
    }

    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── Plank ────────────────────────────────────────────────────────────────────
const PLANK: ExerciseConfig = {
  displayName: "Plank",
  criticalJoints: [
    {
      label: "Shoulder–Hip–Ankle line (primary)",
      description:
        "Body must form a straight line from shoulder to ankle throughout the hold.",
    },
    {
      label: "Hip y vs Shoulder–Ankle midpoint",
      description:
        "Triggers 'Keep your hips down' when hip y is more than 10 normalised units above the shoulder–ankle midpoint (hips piked up).",
    },
  ],
  initialPhase: "hold",
  processFrame(lm, _phase) {
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const ankleMid = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);

    // Shoulder–ankle midpoint y
    const saMiddleY = (shoulderMid.y + ankleMid.y) / 2;

    // ── Hip-above check ───────────────────────────────────────────────────
    // "Hip y is HIGHER than shoulder–ankle midpoint" in screen-space means
    // hipMid.y < saMiddleY (smaller y = higher on screen = hips are piked up).
    // We trigger the cue when the difference exceeds 0.10 normalised units.
    const hipAbove = saMiddleY - hipMid.y > 0.10;
    // Hips sagging downward: hipMid.y > saMiddleY + 0.10
    const hipBelow = hipMid.y - saMiddleY > 0.10;

    const bodyAngle = calcAngle(shoulderMid, hipMid, ankleMid);
    const formScore = clamp(100 - Math.abs(180 - bodyAngle) * 3, 0, 100);

    let audioCue: string | null = null;
    if (hipAbove) {
      audioCue = "Keep your hips down — squeeze your glutes";
    } else if (hipBelow) {
      audioCue = "Raise your hips — body should be straight";
    } else if (formScore < 70) {
      audioCue = "Hold your core tight";
    }

    // Planks do not count reps through range of motion
    return {
      newPhase: "hold",
      repCounted: false,
      repQuality: null,
      formScore,
      audioCue,
    };
  },
};

// ─── Dip ──────────────────────────────────────────────────────────────────────
const DIP: ExerciseConfig = {
  displayName: "Dip",
  criticalJoints: [
    {
      label: "Shoulder–Elbow–Wrist",
      description: "Elbow angle drives rep counting. Elbows stay tucked, not flared.",
    },
    {
      label: "Torso lean",
      description: "Slight forward lean shifts emphasis to the chest.",
    },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const elbowAngle = calcAngle(
      lm[LM.LEFT_SHOULDER],
      lm[LM.LEFT_ELBOW],
      lm[LM.LEFT_WRIST],
    );

    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "up" && elbowAngle < 90) {
      newPhase = "down";
    } else if (phase === "down" && elbowAngle > 150) {
      newPhase = "up";
      repCounted = true;
      repQuality = "complete";
    }

    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const bodyLean = Math.abs(shoulderMid.x - hipMid.x) * 100;
    const formScore = clamp(100 - Math.max(0, bodyLean - 5) * 2, 0, 100);

    const audioCue = formScore < 60 ? "Control the descent — elbows tucked" : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── Lunge ────────────────────────────────────────────────────────────────────
const LUNGE: ExerciseConfig = {
  displayName: "Lunge",
  criticalJoints: [
    {
      label: "Hip–Knee–Ankle (front leg)",
      description: "Front-leg knee angle drives rep counting.",
    },
    {
      label: "Knee alignment",
      description: "Front knee must track directly over the foot, not caving inward.",
    },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const kneeAngle = calcAngle(
      lm[LM.LEFT_HIP],
      lm[LM.LEFT_KNEE],
      lm[LM.LEFT_ANKLE],
    );

    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "up" && kneeAngle < 110) {
      newPhase = "down";
    } else if (phase === "down" && kneeAngle > 155) {
      newPhase = "up";
      repCounted = true;
      repQuality = "complete";
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

// ─── Burpee ───────────────────────────────────────────────────────────────────
const BURPEE: ExerciseConfig = {
  displayName: "Burpee",
  criticalJoints: [
    {
      label: "Shoulder–Hip–Knee",
      description: "Hip angle cycles from deep crouch to full overhead extension.",
    },
    {
      label: "Body alignment (plank phase)",
      description: "Full plank position must be achieved mid-rep.",
    },
  ],
  initialPhase: "up",
  processFrame(lm, phase) {
    const hipAngle = calcAngle(
      lm[LM.LEFT_SHOULDER],
      lm[LM.LEFT_HIP],
      lm[LM.LEFT_KNEE],
    );

    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "up" && hipAngle < 90) {
      newPhase = "down";
    } else if (phase === "down" && hipAngle > 160) {
      newPhase = "up";
      repCounted = true;
      repQuality = "complete";
    }

    const formScore = clamp(hipAngle > 140 ? 90 : hipAngle, 0, 100);
    const audioCue =
      formScore < 60 ? "Explode up — full extension at the top" : null;

    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── Registry & lookup ────────────────────────────────────────────────────────

export const EXERCISE_REGISTRY: Record<string, ExerciseConfig> = {
  "Push-Up": PUSH_UP,
  "Squat": SQUAT,
  "Pull-Up": PULL_UP,
  "Plank": PLANK,
  "Dip": DIP,
  "Lunge": LUNGE,
  "Burpee": BURPEE,
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
