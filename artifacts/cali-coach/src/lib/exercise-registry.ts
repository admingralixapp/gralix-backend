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

// ─── Push Regressions ─────────────────────────────────────────────────────────

// Lv.1 — Wall Push-Up
const WALL_PUSH_UP: ExerciseConfig = {
  displayName: "Wall Push-Up",
  criticalJoints: [
    {
      label: "Shoulder–Elbow–Wrist",
      description: "Elbow angle drives rep counting. Lock out fully at the top.",
    },
    {
      label: "Elbow alignment",
      description: "Keep elbows pointed downward, not flaring wide.",
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

    if (phase === "up" && elbowAngle < 100) {
      newPhase = "down";
    } else if (phase === "down" && elbowAngle > 155) {
      newPhase = "up";
      repCounted = true;
      repQuality = "complete";
    }

    // Form: elbow should not flare (elbows track close to torso)
    const rightElbow = calcAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]);
    const symmetryPenalty = clamp(Math.abs(rightElbow - elbowAngle) * 0.5, 0, 20);
    const formScore = clamp(100 - symmetryPenalty, 0, 100);

    const audioCue = formScore < 70 ? "Keep your elbows pointed down, not flaring" : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// Lv.2 — Incline Push-Up
const INCLINE_PUSH_UP: ExerciseConfig = {
  displayName: "Incline Push-Up",
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

    if (phase === "up" && elbowAngle < 95) {
      newPhase = "down";
    } else if (phase === "down" && elbowAngle > 150) {
      newPhase = "up";
      repCounted = true;
      repQuality = "complete";
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

// Lv.3 — Knee Push-Up  ← SPECIAL LOGIC: body line is Shoulder→Hip→Knee, NOT Shoulder→Hip→Ankle
const KNEE_PUSH_UP: ExerciseConfig = {
  displayName: "Knee Push-Up",
  criticalJoints: [
    {
      label: "Shoulder–Elbow–Wrist",
      description: "Elbow angle drives rep counting. Lock out fully at the top.",
    },
    {
      label: "Shoulder–Hip–Knee line",
      description:
        "Body must stay straight from shoulder to knee — ankles are ignored because knees are the pivot point.",
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

    // KEY DIFFERENCE: body line check uses Shoulder → Hip → Knee (not ankle)
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const kneeMid = midpoint(lm[LM.LEFT_KNEE], lm[LM.RIGHT_KNEE]);
    const bodyAngle = calcAngle(shoulderMid, hipMid, kneeMid);

    // Penalty for hipping — body should be ~180° straight from shoulder to knee
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

// Lv.4 — Full Push-Up (same as original PUSH_UP)
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

// Lv.5 — Diamond Push-Up
const DIAMOND_PUSH_UP: ExerciseConfig = {
  displayName: "Diamond Push-Up",
  criticalJoints: [
    {
      label: "Shoulder–Elbow–Wrist",
      description: "Elbow angle drives rep counting. Elbows must track close to the torso.",
    },
    {
      label: "Shoulder–Hip–Ankle line",
      description: "Maintain a rigid plank throughout — no hip sagging.",
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
    const ankleMid = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);
    const bodyAngle = calcAngle(shoulderMid, hipMid, ankleMid);

    // Penalise elbow flare: left elbow x should stay close to shoulder x
    const elbowFlare = Math.abs(lm[LM.LEFT_ELBOW].x - lm[LM.LEFT_SHOULDER].x) * 100;
    const flarePenalty = clamp(elbowFlare * 0.8, 0, 30);
    const bodyPenalty = clamp(Math.max(0, 180 - bodyAngle) * 2, 0, 40);
    const formScore = clamp(100 - flarePenalty - bodyPenalty, 0, 100);

    let audioCue: string | null = null;
    if (flarePenalty > bodyPenalty && formScore < 65) {
      audioCue = "Keep elbows tucked — they should graze your sides";
    } else if (formScore < 60) {
      audioCue = "Hold the plank — core tight";
    }

    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── Pull Regressions ─────────────────────────────────────────────────────────

// Lv.1 — Scapular Shrugs (hanging, elevate/depress scapula)
const SCAPULAR_SHRUGS: ExerciseConfig = {
  displayName: "Scapular Shrugs",
  criticalJoints: [
    {
      label: "Wrist–Shoulder distance",
      description:
        "Shoulder elevation relative to the bar (wrists). Shrugging up decreases the gap.",
    },
    {
      label: "Arm straightness",
      description: "Keep elbows locked straight throughout — this is a scapula-only movement.",
    },
  ],
  initialPhase: "bottom",
  processFrame(lm, phase) {
    // In normalised coords y=0 = top of image. Wrists are at bar (small y).
    // Shoulders hang below (larger y). Shrugging up = shoulder.y decreases.
    const wristY = (lm[LM.LEFT_WRIST].y + lm[LM.RIGHT_WRIST].y) / 2;
    const shoulderY = (lm[LM.LEFT_SHOULDER].y + lm[LM.RIGHT_SHOULDER].y) / 2;
    const gap = shoulderY - wristY; // positive = shoulders below bar

    // "top" = shoulders shrugged up (gap small)
    // "bottom" = shoulders depressed / dead hang (gap large)
    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "bottom" && gap < 0.18) {
      newPhase = "top";
    } else if (phase === "top" && gap > 0.27) {
      newPhase = "bottom";
      repCounted = true;
      repQuality = "complete";
    }

    // Form: arms should stay extended
    const elbowAngle = calcAngle(lm[LM.LEFT_WRIST], lm[LM.LEFT_ELBOW], lm[LM.LEFT_SHOULDER]);
    const bendPenalty = clamp((160 - elbowAngle) * 1.5, 0, 40);
    const formScore = clamp(100 - bendPenalty, 0, 100);

    const audioCue = formScore < 65 ? "Keep arms straight — only move your shoulder blades" : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// Lv.2 — Australian Rows (inverted row, body under bar)
const AUSTRALIAN_ROWS: ExerciseConfig = {
  displayName: "Australian Rows",
  criticalJoints: [
    {
      label: "Wrist–Elbow–Shoulder",
      description: "Elbow angle drives rep counting — pull until chest reaches bar level.",
    },
    {
      label: "Body plank alignment",
      description: "Keep hips up and body rigid — don't let them sag mid-pull.",
    },
  ],
  initialPhase: "bottom",
  processFrame(lm, phase) {
    // Inverted row: start at arms extended (elbow angle large), pull until chest close to bar.
    const elbowAngle = calcAngle(
      lm[LM.LEFT_WRIST],
      lm[LM.LEFT_ELBOW],
      lm[LM.LEFT_SHOULDER],
    );

    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    if (phase === "bottom" && elbowAngle < 90) {
      newPhase = "top";
    } else if (phase === "top" && elbowAngle > 155) {
      newPhase = "bottom";
      repCounted = true;
      repQuality = "complete";
    }

    // Body plank: shoulder–hip–ankle should be straight
    const shoulderMid = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
    const hipMid = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
    const ankleMid = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);
    const bodyAngle = calcAngle(shoulderMid, hipMid, ankleMid);
    const formScore = clamp(100 - Math.max(0, 180 - bodyAngle) * 2.5, 0, 100);

    const audioCue = formScore < 60 ? "Keep your hips up — rigid body from head to heels" : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// Lv.3 — Negative Pull-Ups (eccentric only — lower from top to dead hang)
const NEGATIVE_PULL_UPS: ExerciseConfig = {
  displayName: "Negative Pull-Ups",
  criticalJoints: [
    {
      label: "Wrist y vs Shoulder y",
      description:
        "Rep starts when chin is over bar (shoulder.y > wrist.y in screen coords). Lower slowly.",
    },
    {
      label: "Wrist–Elbow–Shoulder",
      description: "Rep completes at full arm extension (elbow angle > 160°).",
    },
  ],
  initialPhase: "top",
  processFrame(lm, phase) {
    const elbowAngle = calcAngle(
      lm[LM.LEFT_WRIST],
      lm[LM.LEFT_ELBOW],
      lm[LM.LEFT_SHOULDER],
    );
    const wristY = lm[LM.LEFT_WRIST].y;
    const shoulderY = lm[LM.LEFT_SHOULDER].y;

    let newPhase = phase;
    let repCounted = false;
    let repQuality: RepQuality | null = null;

    // Descend to dead hang
    if (phase === "top" && elbowAngle > 160) {
      newPhase = "bottom";
      repCounted = true;
      repQuality = "complete";
    }
    // Jump/step back to top position
    if (phase === "bottom" && wristY > shoulderY) {
      newPhase = "top";
    }

    // Form: penalise body swing and asymmetry
    const hipMidX = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]).x;
    const shMidX = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]).x;
    const swingPenalty = clamp(Math.abs(hipMidX - shMidX) * 100, 0, 30);
    const formScore = clamp(100 - swingPenalty, 0, 100);

    const audioCue = formScore < 65 ? "Control the descent — no swinging" : null;
    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// Lv.4 — Full Pull-Up
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

// ─── Leg Regressions ─────────────────────────────────────────────────────────

// Lv.1 — Assisted Squat (shallow depth, more forgiving)
const ASSISTED_SQUAT: ExerciseConfig = {
  displayName: "Assisted Squat",
  criticalJoints: [
    {
      label: "Hip–Knee–Ankle (primary)",
      description: "Knee angle drives rep counting. A shallower depth (120°) is acceptable.",
    },
    {
      label: "Torso position",
      description: "Keep your chest tall — use support to avoid leaning forward.",
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

    // Shallower threshold: 120° (vs 100° for full squat)
    if (phase === "up" && kneeAngle < 120) {
      newPhase = "down";
    } else if (phase === "down" && kneeAngle > 160) {
      newPhase = "up";
      repCounted = true;
      repQuality = "complete";
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

// Lv.2 — Air Squat (bodyweight, full depth)
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

      const hipY = lm[LM.LEFT_HIP].y;
      const kneeY = lm[LM.LEFT_KNEE].y;
      repQuality = hipY < kneeY ? "incomplete" : "complete";
    }

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

// Lv.3 — Archer Squat (lateral leg extended)
const ARCHER_SQUAT: ExerciseConfig = {
  displayName: "Archer Squat",
  criticalJoints: [
    {
      label: "Hip–Knee–Ankle (working leg)",
      description: "Track the bending leg — deep knee flexion required.",
    },
    {
      label: "Extended leg straightness",
      description: "Keep the extended leg locked out to the side throughout.",
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
    } else if (phase === "down" && kneeAngle > 155) {
      newPhase = "up";
      repCounted = true;
      const hipY = lm[LM.LEFT_HIP].y;
      const kneeY = lm[LM.LEFT_KNEE].y;
      repQuality = hipY < kneeY ? "incomplete" : "complete";
    }

    // Extended leg check: right knee should be close to straight
    const extLegAngle = calcAngle(
      lm[LM.RIGHT_HIP],
      lm[LM.RIGHT_KNEE],
      lm[LM.RIGHT_ANKLE],
    );
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
    if (extPenalty > torsoPenalty && formScore < 65) {
      audioCue = "Straighten the extended leg — lock that knee out";
    } else if (formScore < 60) {
      audioCue = "Sink lower into the working leg";
    }

    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// Lv.4 — Pistol Squat (single-leg, very deep)
const PISTOL_SQUAT: ExerciseConfig = {
  displayName: "Pistol Squat",
  criticalJoints: [
    {
      label: "Hip–Knee–Ankle (single leg)",
      description: "Track the working leg. Deep flexion required — break 85° at the bottom.",
    },
    {
      label: "Free leg extension",
      description: "Keep the non-working leg extended forward, parallel to ground.",
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

    if (phase === "up" && kneeAngle < 85) {
      newPhase = "down";
    } else if (phase === "down" && kneeAngle > 155) {
      newPhase = "up";
      repCounted = true;
      const hipY = lm[LM.LEFT_HIP].y;
      const kneeY = lm[LM.LEFT_KNEE].y;
      repQuality = hipY < kneeY ? "incomplete" : "complete";
    }

    // Free leg: right ankle should be elevated (not on the floor)
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
    if (freeLegPenalty > 0 && formScore < 70) {
      audioCue = "Extend your free leg forward — don't let it touch the ground";
    } else if (formScore < 60) {
      audioCue = "Sit all the way down — full depth pistol";
    }

    return { newPhase, repCounted, repQuality, formScore, audioCue };
  },
};

// ─── Other exercises (existing) ───────────────────────────────────────────────

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

    const saMiddleY = (shoulderMid.y + ankleMid.y) / 2;
    const hipAbove = saMiddleY - hipMid.y > 0.10;
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

    return {
      newPhase: "hold",
      repCounted: false,
      repQuality: null,
      formScore,
      audioCue,
    };
  },
};

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
  // Push progression
  "Wall Push-Up":     WALL_PUSH_UP,
  "Incline Push-Up":  INCLINE_PUSH_UP,
  "Knee Push-Up":     KNEE_PUSH_UP,
  "Push-Up":          PUSH_UP,
  "Diamond Push-Up":  DIAMOND_PUSH_UP,
  // Pull progression
  "Scapular Shrugs":   SCAPULAR_SHRUGS,
  "Australian Rows":   AUSTRALIAN_ROWS,
  "Negative Pull-Ups": NEGATIVE_PULL_UPS,
  "Pull-Up":           PULL_UP,
  // Legs progression
  "Assisted Squat": ASSISTED_SQUAT,
  "Squat":          SQUAT,
  "Archer Squat":   ARCHER_SQUAT,
  "Pistol Squat":   PISTOL_SQUAT,
  // Core & other
  "Plank":  PLANK,
  "Dip":    DIP,
  "Lunge":  LUNGE,
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
